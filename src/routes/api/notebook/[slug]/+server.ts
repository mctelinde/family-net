import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { readEntry, writeEntry, deleteEntry } from '$lib/server/storage';
import { verifyApiKey } from '$lib/server/auth';

export const GET: RequestHandler = async ({ request, params }) => {
	if (!verifyApiKey(request)) error(401, 'Unauthorized');
	const entry = await readEntry(params.slug, 'agent', true);
	if (!entry) error(404, 'Entry not found');
	return json(entry);
};

export const PUT: RequestHandler = async ({ request, params }) => {
	if (!verifyApiKey(request)) error(401, 'Unauthorized');

	const body = await request.json() as {
		title?: string;
		type?: string;
		visibility?: string;
		owner?: string;
		tags?: string[];
		body?: string;
		data?: Record<string, unknown>;
	};

	// Read existing to merge
	const existing = await readEntry(params.slug, 'agent', true);
	if (!existing) error(404, 'Entry not found');

	const frontmatter: Record<string, unknown> = {
		...existing.data,
		...(body.title ? { title: body.title } : {}),
		...(body.type ? { type: body.type } : {}),
		...(body.visibility ? { visibility: body.visibility } : {}),
		...(body.owner ? { owner: body.owner } : {}),
		...(body.tags ? { tags: body.tags } : {}),
		...body.data,
	};

	await writeEntry(params.slug, frontmatter, body.body ?? '');
	return json({ slug: params.slug });
};

export const DELETE: RequestHandler = async ({ request, params }) => {
	if (!verifyApiKey(request)) error(401, 'Unauthorized');
	const existing = await readEntry(params.slug, 'agent', true);
	if (!existing) error(404, 'Entry not found');
	await deleteEntry(params.slug);
	return new Response(null, { status: 204 });
};
