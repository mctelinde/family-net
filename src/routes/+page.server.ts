import { redirect } from '@sveltejs/kit';
import { listEntries } from '$lib/server/storage';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) redirect(302, '/login');
	const entries = await listEntries(locals.user.userId, locals.user.role === 'admin');
	return { entries };
};
