import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { listEntries, writeEntry } from '$lib/server/storage';
import { verifyApiKey } from '$lib/server/auth';
import { slugify } from '$lib/markdown';

export const GET: RequestHandler = async ({ request }) => {
	if (!verifyApiKey(request)) error(401, 'Unauthorized');
	// Agent calls list with a system user identity (admin-level read)
	const entries = await listEntries('agent', true);
	return json(entries);
};

export const POST: RequestHandler = async ({ request }) => {
	if (!verifyApiKey(request)) error(401, 'Unauthorized');

	const body = await request.json() as {
		slug?: string;
		title: string;
		type: string;
		visibility?: string;
		owner?: string;
		tags?: string[];
		body: string;
		data?: Record<string, unknown>;
	};

	if (!body.title || !body.type) {
		error(400, 'title and type are required');
	}

	const slug = body.slug ?? slugify(body.title);
	const today = new Date().toISOString().slice(0, 10);

	const frontmatter: Record<string, unknown> = {
		title: body.title,
		type: body.type,
		visibility: body.visibility ?? 'family',
		owner: body.owner ?? 'agent',
		tags: body.tags ?? [],
		created: today,
		...body.data,
	};

	await writeEntry(slug, frontmatter, body.body ?? '');
	return json({ slug }, { status: 201 });
};
