import { error, redirect } from '@sveltejs/kit';
import { readEntry } from '$lib/server/storage';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals }) => {
	if (!locals.user) redirect(302, '/login');
	const entry = await readEntry(params.slug, locals.user.userId, locals.user.role === 'admin');
	if (!entry) error(404, 'Entry not found');
	return { entry };
};
