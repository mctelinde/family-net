import { listEntries } from '$lib/server/storage';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const user = locals.user!;
	const entries = await listEntries(user.userId, user.role === 'admin');
	return { entries };
};
