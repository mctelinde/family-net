import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { hasAnyUsers, createUser } from '$lib/server/users';
import { hashPassword, setSession } from '$lib/server/auth';

export const load: PageServerLoad = async ({ locals }) => {
	// If already authenticated, go home regardless of user count
	if (locals.user) redirect(302, '/');
	// Only accessible when no users exist
	if (await hasAnyUsers()) redirect(302, '/login');
	return {};
};

export const actions: Actions = {
	default: async ({ request, cookies }) => {
		if (await hasAnyUsers()) redirect(302, '/login');

		const data = await request.formData();
		const name = (data.get('name') as string)?.trim();
		const email = (data.get('email') as string)?.trim().toLowerCase();
		const password = data.get('password') as string;
		const confirm = data.get('confirm') as string;

		if (!name || !email || !password) {
			return fail(400, { error: 'All fields are required.' });
		}
		if (password !== confirm) {
			return fail(400, { error: 'Passwords do not match.' });
		}
		if (password.length < 8) {
			return fail(400, { error: 'Password must be at least 8 characters.' });
		}

		const user = await createUser(name, email, hashPassword(password), 'admin');
		setSession(cookies, { userId: user.id, name: user.name, email: user.email, role: user.role });
		redirect(302, '/');
	},
};
