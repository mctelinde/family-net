import type {
	AIProvider,
	ChatChunk,
	ChatMessage,
	ChatRequest,
	CompletionRequest,
	ToolCall,
} from '../types';
import { exportTools } from '../tools';

/**
 * Anthropic Claude provider.
 * Uses the Messages API directly via fetch — no SDK dependency.
 */
export class AnthropicProvider implements AIProvider {
	readonly name = 'anthropic';

	private readonly apiKey: string;
	private readonly defaultModel: string;

	constructor(options: { apiKey: string; model?: string }) {
		this.apiKey = options.apiKey;
		this.defaultModel = options.model ?? 'claude-opus-4-5';
	}

	async complete(request: CompletionRequest): Promise<string> {
		// Anthropic separates the system message from the message array
		const system = request.messages.find((m) => m.role === 'system')?.content;
		const messages = request.messages
			.filter((m) => m.role !== 'system')
			.map((m) => ({ role: m.role, content: m.content }));

		const response = await fetch('https://api.anthropic.com/v1/messages', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'x-api-key': this.apiKey,
				'anthropic-version': '2023-06-01',
			},
			body: JSON.stringify({
				model: request.model ?? this.defaultModel,
				max_tokens: request.maxTokens ?? 4096,
				...(system ? { system } : {}),
				messages,
			}),
		});

		if (!response.ok) {
			const text = await response.text();
			throw new Error(`Anthropic API error ${response.status}: ${text}`);
		}

		const data = await response.json() as {
			content: Array<{ type: string; text: string }>;
		};
		return data.content.find((b) => b.type === 'text')?.text ?? '';
	}

	/**
	 * Streaming chat with server-side tool-use.
	 *
	 * Translates Anthropic content-block SSE events to/from the neutral
	 * ChatChunk stream. Tool calls arrive as `tool_use` blocks; tool replies
	 * go back as `tool_result` blocks inside `user` messages.
	 */
	async *chat(request: ChatRequest, signal: AbortSignal): AsyncIterable<ChatChunk> {
		// Translate outgoing messages: split out the system message; convert
		// assistant.tool_calls → tool_use content blocks; convert tool role
		// → user role with tool_result content blocks.
		const system = request.messages.find((m) => m.role === 'system')?.content ?? undefined;
		const messages = request.messages
			.filter((m) => m.role !== 'system')
			.map((m) => translateOutgoing(m))
			.filter((m): m is { role: 'user' | 'assistant'; content: AnthropicContent[] } => m !== null);

		const body = JSON.stringify({
			model: request.model ?? this.defaultModel,
			max_tokens: request.maxTokens ?? 2048,
			...(system ? { system } : {}),
			messages,
			tools: exportTools('anthropic'),
			stream: true,
		});

		const response = await fetch('https://api.anthropic.com/v1/messages', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'x-api-key': this.apiKey,
				'anthropic-version': '2023-06-01',
			},
			body,
			signal,
		});

		if (!response.ok || !response.body) {
			const text = await response.text().catch(() => '');
			throw new Error(`Anthropic API error ${response.status}: ${text}`);
		}

		// Track the current tool_use block by its content-block index.
		interface PendingToolUse {
			index: number;
			id: string;
			name: string;
			arguments: string;
		}
		const toolUses = new Map<number, PendingToolUse>();
		const toolCallMap = new Map<number, ToolCall>();
		const decoder = new TextDecoder();
		const reader = response.body.getReader();
		let buf = '';

		try {
			while (true) {
				const { done, value } = await reader.read();
				if (done) break;
				buf += decoder.decode(value, { stream: true });

				let nlIdx: number;
				while ((nlIdx = buf.indexOf('\n\n')) !== -1) {
					const frame = buf.slice(0, nlIdx);
					buf = buf.slice(nlIdx + 2);

					let eventName = '';
					let dataLine = '';
					for (const rawLine of frame.split('\n')) {
						const line = rawLine.trim();
						if (line.startsWith('event:')) eventName = line.slice(6).trim();
						else if (line.startsWith('data:')) dataLine = line.slice(5).trim();
					}
					if (!dataLine || dataLine === '[DONE]') continue;

					let parsed: AnthropicStreamEvent;
					try {
						parsed = JSON.parse(dataLine) as AnthropicStreamEvent;
					} catch {
						continue;
					}

					if (parsed.type === 'error') {
						throw new Error(`Anthropic stream error: ${parsed.error?.message ?? 'unknown'}`);
					}

					if (parsed.type === 'content_block_start') {
						const block = parsed.content_block;
						const blockIndex = parsed.index;
						if (block && block.type === 'tool_use' && typeof blockIndex === 'number') {
							const id = block.id ?? '';
							const name = block.name ?? '';
							toolUses.set(blockIndex, {
								index: blockIndex,
								id,
								name,
								arguments: '',
							});
							toolCallMap.set(blockIndex, {
								id,
								name,
								arguments: '',
							});
							yield {
								delta: {
									tool_calls: [{ index: blockIndex, id, name }],
								},
							};
						} else if (block && block.type === 'text') {
							yield { delta: { role: 'assistant' } };
						}
						continue;
					}

					if (parsed.type === 'content_block_delta') {
						const d = parsed.delta;
						const blockIndex = parsed.index;
						if (d?.type === 'text_delta' && d.text) {
							yield { delta: { content: d.text } };
						} else if (d?.type === 'input_json_delta' && d.partial_json && typeof blockIndex === 'number') {
							const pending = toolUses.get(blockIndex);
							if (pending) {
								pending.arguments += d.partial_json;
								const tc = toolCallMap.get(blockIndex);
								if (tc) tc.arguments += d.partial_json;
								yield {
									delta: {
										tool_calls: [{ index: blockIndex, arguments: d.partial_json }],
									},
								};
							}
						}
						continue;
					}

					if (parsed.type === 'message_delta') {
						const sr = parsed.delta?.stop_reason;
						if (sr === 'tool_use') {
							yield { delta: {}, finish_reason: 'tool_calls' };
						} else if (sr === 'max_tokens') {
							yield { delta: {}, finish_reason: 'length' };
						} else if (sr === 'end_turn') {
							yield { delta: {}, finish_reason: 'stop' };
						}
						continue;
					}

					// message_start, content_block_stop, ping, message_stop: ignored
				}
			}
		} finally {
			reader.releaseLock();
		}
	}
}

// ---------------------------------------------------------------------------
// Anthropic message translation helpers
// ---------------------------------------------------------------------------

type AnthropicContent =
	| { type: 'text'; text: string }
	| { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
	| { type: 'tool_result'; tool_use_id: string; content: string; is_error?: boolean };

interface AnthropicStreamEvent {
	type:
		| 'message_start'
		| 'content_block_start'
		| 'content_block_delta'
		| 'content_block_stop'
		| 'message_delta'
		| 'message_stop'
		| 'ping'
		| 'error';
	index?: number;
	content_block?: AnthropicContentBlock;
	delta?: AnthropicDelta;
	error?: { type?: string; message?: string };
}

interface AnthropicContentBlock {
	type: 'text' | 'tool_use';
	id?: string;
	name?: string;
	text?: string;
	input?: Record<string, unknown>;
}

interface AnthropicDelta {
	type?: 'text_delta' | 'input_json_delta' | string;
	text?: string;
	partial_json?: string;
	stop_reason?: 'end_turn' | 'tool_use' | 'max_tokens' | string;
}

function translateOutgoing(
	m: ChatMessage
): { role: 'user' | 'assistant'; content: AnthropicContent[] } | null {
	if (m.role === 'user' || m.role === 'system') {
		return { role: 'user', content: [{ type: 'text', text: m.content ?? '' }] };
	}
	if (m.role === 'assistant') {
		const blocks: AnthropicContent[] = [];
		if (m.content) blocks.push({ type: 'text', text: m.content });
		if (m.tool_calls) {
			for (const tc of m.tool_calls) {
				let input: Record<string, unknown> = {};
				try {
					input = JSON.parse(tc.arguments) as Record<string, unknown>;
				} catch {
					input = {};
				}
				blocks.push({ type: 'tool_use', id: tc.id, name: tc.name, input });
			}
		}
		return { role: 'assistant', content: blocks };
	}
	if (m.role === 'tool') {
		const isError = m.content?.startsWith('"error"') || m.content?.includes('"error":');
		return {
			role: 'user',
			content: [
				{
					type: 'tool_result',
					tool_use_id: m.tool_call_id ?? '',
					content: m.content ?? '',
					...(isError ? { is_error: true } : {}),
				},
			],
		};
	}
	return null;
}
