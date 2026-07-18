import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { exportTools } from '$lib/server/ai/tools';
import type { ToolSchemaFormat } from '$lib/server/ai/types';

/**
 * GET /api/tools?format=openai|anthropic|openapi
 *
 * Returns notebook tool definitions in the requested LLM format.
 * No auth required — schemas are public so any agent can self-configure.
 */
export const GET: RequestHandler = ({ url }) => {
	const format = (url.searchParams.get('format') ?? 'openapi') as ToolSchemaFormat;
	const tools = exportTools(format);
	return json(tools, {
		headers: {
			'Access-Control-Allow-Origin': '*',
		},
	});
};
