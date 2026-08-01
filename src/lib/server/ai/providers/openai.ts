import type { AIProvider, ChatChunk, ChatRequest, CompletionRequest, ToolCall } from '../types';
import { exportTools } from '../tools';

/**
 * Parses a Hermes-style tool-call block emitted by models like qwen2.5-coder
 * that do not use the OpenAI delta.tool_calls channel.
 *
 * Expected format in content text:
 *   <tool_call>
 *   {"name": "some_tool", "parameters": {...}}
 *   </tool_call>
 *
 * Returns null if the text does not contain a valid block.
 */
function extractHermesToolCall(raw: string): { name: string; argumentsJson: string } | null {
	const match = raw.match(/<tool_call>\s*([\s\S]*?)\s*<\/tool_call>/);
	if (!match) return null;
	try {
		const obj = JSON.parse(match[1]) as { name?: unknown; parameters?: unknown };
		if (typeof obj.name !== 'string') return null;
		return { name: obj.name, argumentsJson: JSON.stringify(obj.parameters ?? {}) };
	} catch {
		return null;
	}
}

/**
 * OpenAI-compatible provider.
 * Works with OpenAI, Azure OpenAI, Ollama, LM Studio, vLLM,
 * or any endpoint that speaks the OpenAI Chat Completions API.
 *
 * Set OPENAI_BASE_URL to point at a local model:
 *   http://localhost:11434/v1   → Ollama
 *   http://localhost:1234/v1    → LM Studio
 */
export class OpenAIProvider implements AIProvider {
	readonly name = 'openai-compatible';

	private readonly baseUrl: string;
	private readonly apiKey: string;
	private readonly defaultModel: string;

	constructor(options: {
		apiKey: string;
		baseUrl?: string;
		model?: string;
	}) {
		this.apiKey = options.apiKey;
		this.baseUrl = (options.baseUrl ?? 'https://api.openai.com/v1').replace(/\/$/, '');
		this.defaultModel = options.model ?? 'gpt-4o';
	}

	async complete(request: CompletionRequest): Promise<string> {
		const response = await fetch(`${this.baseUrl}/chat/completions`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${this.apiKey}`,
			},
			body: JSON.stringify({
				model: request.model ?? this.defaultModel,
				messages: request.messages,
				max_tokens: request.maxTokens ?? 4096,
				temperature: request.temperature ?? 0.7,
			}),
		});

		if (!response.ok) {
			const text = await response.text();
			throw new Error(`OpenAI-compatible API error ${response.status}: ${text}`);
		}

		const data = await response.json() as {
			choices: Array<{ message: { content: string } }>;
		};
		return data.choices[0]?.message?.content ?? '';
	}

	/**
	 * Streaming chat with server-side tool-use.
	 *
	 * Aggregates tool_call deltas by index. On `finish_reason === 'tool_calls'`
	 * emits a terminal chunk carrying the full AssistantMessage. `data:[DONE]`
	 * ends the iterator. Non-2xx → throws (route maps to 502).
	 */
	async *chat(request: ChatRequest, signal: AbortSignal): AsyncIterable<ChatChunk> {
		const body = JSON.stringify({
			model: request.model ?? this.defaultModel,
			messages: request.messages,
			stream: request.stream ?? true,
			max_tokens: request.maxTokens ?? 2048,
			temperature: request.temperature ?? 0.7,
			tools: exportTools('openai'),
			tool_choice: 'auto',
		});

		const response = await fetch(`${this.baseUrl}/chat/completions`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${this.apiKey}`,
			},
			body,
			signal,
		});

		if (!response.ok || !response.body) {
			const text = await response.text().catch(() => '');
			throw new Error(`OpenAI-compatible API error ${response.status}: ${text}`);
		}

		// Aggregate tool_call deltas across chunks. Keyed by the tool_call index.
		const toolCallMap = new Map<number, ToolCall>();
		let contentBuf = '';
		const decoder = new TextDecoder();

		const reader = response.body.getReader();
		let buf = '';
		try {
			while (true) {
				const { done, value } = await reader.read();
				if (done) break;
				buf += decoder.decode(value, { stream: true });

				// SSE frames are separated by a blank line.
				let nlIdx: number;
				while ((nlIdx = buf.indexOf('\n\n')) !== -1) {
					const frame = buf.slice(0, nlIdx);
					buf = buf.slice(nlIdx + 2);

					for (const rawLine of frame.split('\n')) {
						const line = rawLine.trim();
						if (!line.startsWith('data:')) continue;
						const payload = line.slice(5).trim();
						if (payload === '[DONE]') return;
						if (!payload) continue;

						let parsed: {
							choices?: Array<{
								finish_reason?: string | null;
								delta?: {
									role?: 'assistant';
									content?: string | null;
									tool_calls?: Array<{
										index: number;
										id?: string;
										function?: { name?: string; arguments?: string };
									}>;
								};
							}>;
						};
						try {
							parsed = JSON.parse(payload);
						} catch {
							continue; // skip malformed frames
						}

						const choice = parsed.choices?.[0];
						if (!choice) continue;
						const delta = choice.delta ?? {};

						const out: ChatChunk = { delta: {} };

						if (delta.role) out.delta.role = delta.role;

						if (typeof delta.content === 'string' && delta.content.length > 0) {
							contentBuf += delta.content;
								// Once a Hermes <tool_call> sentinel appears, suppress content
								// deltas so raw JSON is never forwarded to the client.
								if (!contentBuf.includes('<tool_call>')) {
									out.delta.content = delta.content;
								}
						}

						if (delta.tool_calls && delta.tool_calls.length > 0) {
							out.delta.tool_calls = [];
							for (const tc of delta.tool_calls) {
								const existing = toolCallMap.get(tc.index);
								if (!existing) {
									const fresh: ToolCall = {
										id: tc.id ?? '',
										name: tc.function?.name ?? '',
										arguments: tc.function?.arguments ?? '',
									};
									toolCallMap.set(tc.index, fresh);
									out.delta.tool_calls.push({
										index: tc.index,
										id: fresh.id || undefined,
										name: fresh.name || undefined,
										arguments: fresh.arguments || undefined,
									});
								} else {
									if (tc.id) existing.id = tc.id;
									if (tc.function?.name) existing.name = tc.function.name;
									if (tc.function?.arguments) existing.arguments += tc.function.arguments;
									out.delta.tool_calls.push({
										index: tc.index,
										id: tc.id || undefined,
										name: tc.function?.name || undefined,
										arguments: tc.function?.arguments || undefined,
									});
								}
							}
						}

						if (choice.finish_reason) {
							const fr = choice.finish_reason;
							const map = {
								stop: 'stop',
								tool_calls: 'tool_calls',
								length: 'length',
							} as const;

								if (fr === 'stop') {
									const hermes = extractHermesToolCall(contentBuf);
									if (hermes) {
										// The model emitted a Hermes tool call as plain text.
										// Synthesize a proper tool_calls finish so the route's
										// dispatch loop activates without any changes.
										const id = `call_hermes_${Date.now()}`;
										yield {
											delta: {
												tool_calls: [
													{
														index: 0,
														id,
														name: hermes.name,
														arguments: hermes.argumentsJson,
													},
												],
											},
										};
										yield { delta: {}, finish_reason: 'tool_calls' };
										return;
									}
									// No Hermes block — if content was suppressed for any reason,
									// flush it now before emitting the stop signal.
									if (contentBuf && out.delta.content === undefined) {
										yield { delta: { content: contentBuf } };
									}
								}

								out.finish_reason = map[fr as keyof typeof map] ?? 'stop';
							}

						// Yield even when delta is empty but a terminal signal is attached.
						if (
							out.delta.role ||
							out.delta.content !== undefined ||
							(out.delta.tool_calls && out.delta.tool_calls.length > 0) ||
							out.finish_reason
						) {
							yield out;
						}
					}
				}
			}
		} finally {
			reader.releaseLock();
		}
	}
}
