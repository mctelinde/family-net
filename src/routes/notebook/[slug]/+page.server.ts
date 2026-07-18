import { error } from '@sveltejs/kit';
import { readEntry } from '$lib/server/storage';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals }) => {
	const user = locals.user!;
	const entry = await readEntry(params.slug, user.userId, user.role === 'admin');
	if (!entry) error(404, 'Entry not found');
	return { entry };
};
