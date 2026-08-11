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
	chat(request: ChatRequest, signal: AbortSignal): AsyncIterable<ChatChunk>;
}

// ---------------------------------------------------------------------------
// Streaming chat + tool-use
// ---------------------------------------------------------------------------

export type ChatRole = 'user' | 'assistant' | 'system' | 'tool';

export interface ToolCall {
	id: string; // provider-assigned; round-trips into the 'tool' reply
	name: string; // matches a NOTEBOOK_TOOLS[i].name
	arguments: string; // RAW JSON STRING — parse lazily in the route
}

export interface ChatMessage {
	role: ChatRole;
	content: string | null; // null on tool-only assistant turns
	name?: string; // 'tool' role: the tool name
	tool_call_id?: string; // 'tool' role: id of the tool_call being replied to
	tool_calls?: ToolCall[]; // 'assistant' role
}

export interface ChatRequest {
	messages: ChatMessage[];
	model?: string;
	maxTokens?: number; // default 2048 inside chat()
	temperature?: number; // default 0.7 inside chat()
	stream?: boolean; // default true
	tools?: ToolDefinition[]; // default NOTEBOOK_TOOLS
}

export interface AssistantMessage {
	role: 'assistant';
	content: string | null;
	tool_calls: ToolCall[];
	finish_reason: 'stop' | 'tool_calls' | 'length';
}

export interface ChatChunk {
	delta: {
		role?: 'assistant';
		content?: string;
		tool_calls?: Array<{
			index: number;
			id?: string;
			name?: string;
			arguments?: string; // incremental JSON fragment
		}>;
	};
	finish_reason?: 'stop' | 'tool_calls' | 'length' | 'timeout' | 'error';
	message?: AssistantMessage; // populated on the terminal chunk
	error?: { code: number; message: string };
	/** Standalone, non-delta chunk: notebook entries auto-injected as context for this turn. */
	context?: Array<{ slug: string; title: string; type: string; score: number }>;
}

export interface ChatResponse {
	message: AssistantMessage;
	usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
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
