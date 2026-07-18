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
