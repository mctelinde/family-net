import type { AIProvider, CompletionRequest } from '../types';

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
}
