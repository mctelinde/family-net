import { env } from '$env/dynamic/private';
import type { ToolDefinition, ToolSchemaFormat } from './types';

/** Canonical tool definitions for the Family Net notebook API */
export const NOTEBOOK_TOOLS: ToolDefinition[] = [
	{
		name: 'list_entries',
		description: 'List all notebook entries the current user can access. Returns slugs, titles, types, tags, and last-updated dates.',
		parameters: {
			type: 'object',
			properties: {
				type: {
					type: 'string',
					enum: ['note', 'business-plan', 'fitness-goals', 'finance-tracker'],
					description: 'Filter entries by widget type. Omit to return all types.',
				},
				visibility: {
					type: 'string',
					enum: ['private', 'family'],
					description: 'Filter by visibility. Omit to return all.',
				},
			},
			required: [],
		},
	},
	{
		name: 'read_entry',
		description: 'Read the full content of a notebook entry by its slug, including frontmatter data and rendered body.',
		parameters: {
			type: 'object',
			properties: {
				slug: {
					type: 'string',
					description: 'The URL-safe slug identifying the entry (e.g. "software-company-plan").',
				},
			},
			required: ['slug'],
		},
	},
	{
		name: 'write_entry',
		description:
			'Create or update a notebook entry. Provide frontmatter fields and a markdown body. ' +
			'The slug is derived from the title if not supplied. ' +
			'Set type to control which widget renders the entry.',
		parameters: {
			type: 'object',
			properties: {
				slug: {
					type: 'string',
					description: 'Unique URL-safe identifier. Auto-derived from title if omitted.',
				},
				title: { type: 'string', description: 'Human-readable entry title.' },
				type: {
					type: 'string',
					enum: ['note', 'business-plan', 'fitness-goals', 'finance-tracker'],
					description: 'Widget type that controls how the entry is rendered.',
				},
				visibility: {
					type: 'string',
					enum: ['private', 'family'],
					description: '"private" = only the owner sees it. "family" = all members see it.',
				},
				tags: {
					type: 'array',
					items: { type: 'string' },
					description: 'Optional list of topic tags.',
				},
				body: {
					type: 'string',
					description: 'Full markdown content of the entry body (after the frontmatter).',
				},
				data: {
					type: 'object',
					description:
						'Additional type-specific frontmatter fields (e.g. goals, milestones, budget). ' +
						'Structure depends on the widget type.',
					properties: {},
					required: [],
				},
			},
			required: ['title', 'type', 'body'],
		},
	},
	{
		name: 'delete_entry',
		description: 'Permanently delete a notebook entry by its slug.',
		parameters: {
			type: 'object',
			properties: {
				slug: { type: 'string', description: 'Slug of the entry to delete.' },
			},
			required: ['slug'],
		},
	},
];

/** Dev-only tools — only included when ENABLE_DEV_TOOLS=true in env. */
export const DEV_TOOLS: ToolDefinition[] = [
	{
		name: 'list_dir',
		description:
			'List the files and subdirectories inside a directory. ' +
			'Paths are relative to the project root or absolute. ' +
			'Returns an array of entries with name, type ("file" or "dir"), and path.',
		parameters: {
			type: 'object',
			properties: {
				path: {
					type: 'string',
					description: 'Directory path to list (relative to project root or absolute). Defaults to the project root if omitted.',
				},
			},
			required: [],
		},
	},
	{
		name: 'search_files',
		description:
			'Search for a text pattern across files in the project using git grep. ' +
			'Returns matching lines with file path and line number. ' +
			'Results are capped at 50 matches. Use glob to restrict to specific file types.',
		parameters: {
			type: 'object',
			properties: {
				pattern: {
					type: 'string',
					description: 'Text or regex pattern to search for.',
				},
				glob: {
					type: 'string',
					description: 'Optional glob to restrict which files are searched, e.g. "*.ts" or "src/**/*.svelte".',
				},
				case_sensitive: {
					type: 'boolean',
					description: 'Whether the search is case-sensitive. Defaults to false.',
				},
			},
			required: ['pattern'],
		},
	},
	{
		name: 'read_file',
		description:
			'Read the text content of a file on the server. ' +
			'Paths are relative to the project root or absolute. ' +
			'Returns the file content as a string, or an error object. ' +
			'For large files, use start_line and end_line to read a specific range of lines.',
		parameters: {
			type: 'object',
			properties: {
				path: { type: 'string', description: 'File path to read (relative to project root or absolute).' },
				start_line: { type: 'integer', description: 'First line to return (1-based, inclusive). Omit to start from line 1.' },
				end_line: { type: 'integer', description: 'Last line to return (1-based, inclusive). Omit to read to end of file.' },
			},
			required: ['path'],
		},
	},
	{
		name: 'write_file',
		description:
			'Write text content to a file on the server, creating it if it does not exist. ' +
			'Paths are relative to the project root or absolute. ' +
			'Existing files are overwritten. Use patch_file instead when making small targeted changes.',
		parameters: {
			type: 'object',
			properties: {
				path: { type: 'string', description: 'File path to write (relative to project root or absolute).' },
				content: { type: 'string', description: 'Full text content to write to the file.' },
			},
			required: ['path', 'content'],
		},
	},
	{
		name: 'patch_file',
		description:
			'Make a targeted edit to a file. Two modes:\n' +
			'1. LINE MODE (preferred): provide line_number and patch_content (prefix with "-" to delete the line) or new_line to replace it.\n' +
			'2. FIND-REPLACE mode: provide old (exact text to find) and new (replacement text).\n' +
			'Always prefer line mode — it avoids whitespace matching issues.',
		parameters: {
			type: 'object',
			properties: {
				path:          { type: 'string',  description: 'File path to patch (relative to project root). Also accepted as file_path.' },
				line_number:   { type: 'number',  description: 'Line number to edit (1-based). Use with patch_content or new_line.' },
				patch_content: { type: 'string',  description: 'In line mode: content for the line. Prefix with "-" to delete the line.' },
				new_line:      { type: 'string',  description: 'In line mode: replacement text for the line.' },
				old:           { type: 'string',  description: 'In find-replace mode: exact text to find. Also accepted as old_text.' },
				old_text:      { type: 'string',  description: 'Alias for old.' },
				new:           { type: 'string',  description: 'In find-replace mode: replacement text. Use empty string to delete. Also accepted as new_text.' },
				new_text:      { type: 'string',  description: 'Alias for new.' },
			},
			required: ['path'],
		},
	},
	{
		name: 'run_command',
		description:
			'Run a whitelisted shell command in the project root directory. ' +
			'Allowed executables: git, npm, npx, node, tsc, prettier, eslint. ' +
			'Pass arguments as an array. Returns stdout, stderr, and exit code. ' +
			'Execution is capped at 30 seconds.',
		parameters: {
			type: 'object',
			properties: {
				command: {
					type: 'string',
					enum: ['git', 'npm', 'npx', 'node', 'tsc', 'prettier', 'eslint'],
					description: 'The executable to run.',
				},
				args: {
					type: 'array',
					items: { type: 'string' },
					description: 'Command-line arguments to pass to the executable.',
				},
			},
			required: ['command'],
		},
	},
];

/** Returns the active tool set: notebook tools, plus dev tools when enabled. */
export function getActiveTools(): ToolDefinition[] {
	return env.ENABLE_DEV_TOOLS === 'true' ? [...NOTEBOOK_TOOLS, ...DEV_TOOLS] : NOTEBOOK_TOOLS;
}

/** Export tool definitions in the format expected by each LLM provider */
export function exportTools(format: ToolSchemaFormat): unknown {
	switch (format) {
		case 'openai':
			return NOTEBOOK_TOOLS.map((t) => ({
				type: 'function',
				function: {
					name: t.name,
					description: t.description,
					parameters: t.parameters,
				},
			}));

		case 'anthropic':
			return NOTEBOOK_TOOLS.map((t) => ({
				name: t.name,
				description: t.description,
				input_schema: t.parameters,
			}));

		case 'openapi':
			return buildOpenAPISpec();

		default:
			return NOTEBOOK_TOOLS;
	}
}

function buildOpenAPISpec(): unknown {
	return {
		openapi: '3.1.0',
		info: {
			title: 'Family Net Notebook API',
			description: 'REST API for reading and writing notebook entries. Usable by any LLM agent.',
			version: '1.0.0',
		},
		servers: [{ url: '/api' }],
		security: [{ bearerAuth: [] }],
		components: {
			securitySchemes: {
				bearerAuth: { type: 'http', scheme: 'bearer', description: 'Set AGENT_API_KEY in env.' },
			},
		},
		paths: {
			'/chat': {
				post: {
					operationId: 'chat_stream',
					summary: 'Streaming chat with tool-use loop over the notebook API',
					security: [{ bearerAuth: [] }],
					requestBody: {
						required: true,
						content: {
							'application/json': {
								schema: {
									type: 'object',
									required: ['messages'],
									properties: {
										messages: {
											type: 'array',
											description:
												'Conversation history. Each item has `role` ("user"|"assistant"|"system"|"tool"), `content`, and optional `tool_calls` / `tool_call_id` fields.',
											items: { type: 'object' },
										},
										model: {
											type: 'string',
											description: 'Override the configured model for this request.',
										},
										maxTokens: { type: 'integer', default: 2048 },
										temperature: { type: 'number', default: 0.7 },
										stream: { type: 'boolean', default: true },
									},
								},
							},
						},
					},
					responses: {
						'200': {
							description:
								'text/event-stream of ChatChunk deltas, terminated by `data:[DONE]`.',
							content: {
								'text/event-stream': { schema: { type: 'string' } },
							},
						},
						'400': { description: 'Missing or malformed `messages` field.' },
						'401': { description: 'Missing or bad bearer token.' },
						'503': { description: 'AI provider not configured.' },
					},
				},
			},
			'/notebook': {
				get: {
					operationId: 'list_entries',
					summary: 'List notebook entries',
					parameters: [
						{ name: 'type', in: 'query', schema: { type: 'string' } },
						{ name: 'visibility', in: 'query', schema: { type: 'string' } },
					],
					responses: { '200': { description: 'Array of entry metadata' } },
				},
				post: {
					operationId: 'write_entry',
					summary: 'Create a new notebook entry',
					requestBody: {
						required: true,
						content: { 'application/json': { schema: { $ref: '#/components/schemas/EntryPayload' } } },
					},
					responses: { '201': { description: 'Entry created' } },
				},
			},
			'/notebook/{slug}': {
				get: {
					operationId: 'read_entry',
					summary: 'Read a notebook entry',
					parameters: [{ name: 'slug', in: 'path', required: true, schema: { type: 'string' } }],
					responses: { '200': { description: 'Full entry with rendered body' } },
				},
				put: {
					operationId: 'update_entry',
					summary: 'Update an existing notebook entry',
					parameters: [{ name: 'slug', in: 'path', required: true, schema: { type: 'string' } }],
					requestBody: {
						required: true,
						content: { 'application/json': { schema: { $ref: '#/components/schemas/EntryPayload' } } },
					},
					responses: { '200': { description: 'Entry updated' } },
				},
				delete: {
					operationId: 'delete_entry',
					summary: 'Delete a notebook entry',
					parameters: [{ name: 'slug', in: 'path', required: true, schema: { type: 'string' } }],
					responses: { '204': { description: 'Deleted' } },
				},
			},
		},
	};
}
