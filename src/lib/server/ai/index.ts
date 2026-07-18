import type { AIProvider } from './types';
import { OpenAIProvider } from './providers/openai';
import { AnthropicProvider } from './providers/anthropic';
import { env } from '$env/dynamic/private';

export type { AIProvider, CompletionRequest, ToolDefinition, ToolSchemaFormat } from './types';

/**
 * Returns the configured AI provider based on environment variables.
 *
 * AI_PROVIDER=openai|anthropic|ollama|none
 * OPENAI_API_KEY / ANTHROPIC_API_KEY
 * OPENAI_BASE_URL   — override endpoint (Ollama: http://localhost:11434/v1)
 * AI_MODEL          — model name override
 */
export function getAIProvider(): AIProvider | null {
	const provider = env.AI_PROVIDER ?? 'none';
	const model = env.AI_MODEL;

	switch (provider) {
		case 'openai': {
			const apiKey = env.OPENAI_API_KEY;
			if (!apiKey) throw new Error('OPENAI_API_KEY is required for AI_PROVIDER=openai');
			return new OpenAIProvider({
				apiKey,
				baseUrl: env.OPENAI_BASE_URL,
				model,
			});
		}

		case 'anthropic': {
			const apiKey = env.ANTHROPIC_API_KEY;
			if (!apiKey) throw new Error('ANTHROPIC_API_KEY is required for AI_PROVIDER=anthropic');
			return new AnthropicProvider({ apiKey, model });
		}

		// Ollama speaks the OpenAI Chat Completions API — reuse the OpenAI provider
		case 'ollama': {
			return new OpenAIProvider({
				apiKey: 'ollama', // Ollama doesn't require a real key
				baseUrl: env.OPENAI_BASE_URL ?? 'http://localhost:11434/v1',
				model: model ?? 'llama3',
			});
		}

		case 'none':
		default:
			return null;
	}
}
