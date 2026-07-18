import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';
import { hasAnyUsers } from '$lib/server/users';

export const load: LayoutServerLoad = async ({ locals, url }) => {
	const isSetup = url.pathname.startsWith('/setup');
	const isLogin = url.pathname.startsWith('/login');
	const isApi = url.pathname.startsWith('/api');

	// API routes handle their own auth
	if (isApi) return { user: null };

	// First-run: no users exist → force setup
	const hasUsers = await hasAnyUsers();
	if (!hasUsers && !isSetup) redirect(302, '/setup');

	// Protected routes require a session
	if (!locals.user && !isLogin && !isSetup) redirect(302, '/login');

	return { user: locals.user };
};
