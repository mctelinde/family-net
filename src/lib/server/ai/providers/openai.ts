import type { AIProvider, CompletionRequest } from '../types';

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
}
