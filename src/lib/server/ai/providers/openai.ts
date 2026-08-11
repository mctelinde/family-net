import type { AIProvider, ChatChunk, ChatRequest, CompletionRequest, ToolCall } from '../types';
import { exportTools } from '../tools';

/**
 * Parses a Hermes-style tool-call block emitted by models like qwen2.5-coder
 * that do not use the OpenAI delta.tool_calls channel.
 *
 * Supports two formats:
 *   Tagged:   <tool_call>{"name":"...", "parameters":{...}}</tool_call>
 *   Raw JSON: {"name":"...", "arguments":{...}}  (no wrapper tags)
 *
 * Accepts both "parameters" and "arguments" as the args field name.
 * Takes only the first complete top-level JSON object when multiple appear.
 * Returns null if no recognisable tool call is found.
 */
function extractHermesToolCall(raw: string): { name: string; argumentsJson: string } | null {
	// 1. Try <tool_call>...</tool_call> format
	const tagged = raw.match(/<tool_call>\s*([\s\S]*?)\s*<\/tool_call>/);
	if (tagged) return parseToolJson(tagged[1].trim());

	// 2. Try raw JSON — walk the string to find the first complete top-level object
	const first = raw.indexOf('{');
	if (first === -1) return null;

	let depth = 0, inStr = false, escape = false;
	for (let i = first; i < raw.length; i++) {
		const ch = raw[i];
		if (escape)              { escape = false; continue; }
		if (ch === '\\' && inStr){ escape = true;  continue; }
		if (ch === '"')          { inStr = !inStr;  continue; }
		if (inStr) continue;
		if (ch === '{') depth++;
		if (ch === '}' && --depth === 0) return parseToolJson(raw.slice(first, i + 1));
	}
	return null;
}

function parseToolJson(src: string): { name: string; argumentsJson: string } | null {
	try {
		const obj = JSON.parse(src) as { name?: unknown; parameters?: unknown; arguments?: unknown };
		if (typeof obj.name !== 'string') return null;
		return {
			name:          obj.name,
			argumentsJson: JSON.stringify(obj.parameters ?? obj.arguments ?? {}),
		};
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
		// Translate internal ToolCall shape → OpenAI wire format before sending.
		// Our ToolCall uses { id, name, arguments }; the API requires
		// { id, type:'function', function:{ name, arguments } }.
		const messages = request.messages.map((m) => {
			if (!m.tool_calls?.length) return m;
			return {
				...m,
				tool_calls: m.tool_calls.map((tc) => ({
					id:       tc.id,
					type:     'function' as const,
					function: { name: tc.name, arguments: tc.arguments },
				})),
			};
		});

		const body = JSON.stringify({
			model: request.model ?? this.defaultModel,
			messages,
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
		// Length of contentBuf already forwarded to the client as content deltas.
		// Anything beyond this is "pending" — held back until we're sure it isn't
		// the start of a Hermes-style tool call block (raw JSON, <tool_call> tag,
		// or a ```json code fence), so the client never sees the same tool call
		// rendered both as prose text and as a tool-call card.
		let streamedLen = 0;
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
								// Only the *unstreamed* tail is checked — once real prose has
								// already been forwarded to the client, a Hermes tool call can
								// still start partway through the message (e.g. "I'll look that
								// up.\n{...}"). Holding back the pending suffix here (instead of
								// checking contentBuf as a whole) stops that JSON from ever being
								// shown as prose text before it's re-emitted as a tool_calls chunk.
								const pending = contentBuf.slice(streamedLen);
								const pendingStart = pending.trimStart();
								const suppress = pendingStart.startsWith('<tool_call>') ||
									pendingStart.startsWith('{') ||
									pendingStart.startsWith('`');
								if (!suppress && pending.length > 0) {
									out.delta.content = pending;
									streamedLen = contentBuf.length;
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
									// No Hermes block — flush whatever pending content was held
									// back (on the chance it turned out to be a false alarm).
									const pending = contentBuf.slice(streamedLen);
									if (pending) {
										yield { delta: { content: pending } };
										streamedLen = contentBuf.length;
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
