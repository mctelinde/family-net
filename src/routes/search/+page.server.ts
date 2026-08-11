import { redirect } from '@sveltejs/kit';
import { search } from '$lib/server/search';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	if (!locals.user) redirect(302, '/login');

	const q = url.searchParams.get('q') ?? '';
	const results = q ? await search(q, locals.user.userId, locals.user.role === 'admin') : [];
	return { query: q, results };
};
