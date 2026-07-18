export interface Message {
	role: 'user' | 'assistant' | 'system';
	content: string;
}

export interface CompletionRequest {
	messages: Message[];
	/** Override the configured model for this request */
	model?: string;
	maxTokens?: number;
	temperature?: number;
}

export interface AIProvider {
	readonly name: string;
	complete(request: CompletionRequest): Promise<string>;
}

/** Supported tool schema export formats */
export type ToolSchemaFormat = 'openai' | 'anthropic' | 'openapi';

export interface ToolParameter {
	type: string;
	description?: string;
	enum?: string[];
	properties?: Record<string, ToolParameter>;
	items?: ToolParameter;
	required?: string[];
}

export interface ToolDefinition {
	name: string;
	description: string;
	parameters: {
		type: 'object';
		properties: Record<string, ToolParameter>;
		required: string[];
	};
}
