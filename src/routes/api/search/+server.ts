import { json } from '@sveltejs/kit';
import { search } from '$lib/server/search';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, locals }) => {
	if (!locals.user) return json({ error: 'Unauthorized' }, { status: 401 });

	const q = url.searchParams.get('q') ?? '';
	const results = await search(q, locals.user.userId, locals.user.role === 'admin');
	return json({ results });
};
