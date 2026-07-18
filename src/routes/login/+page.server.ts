import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { findUserByEmail } from '$lib/server/users';
import { verifyPassword, setSession } from '$lib/server/auth';

export const load: PageServerLoad = async ({ locals }) => {
	if (locals.user) redirect(302, '/');
	return {};
};

export const actions: Actions = {
	default: async ({ request, cookies }) => {
		const data = await request.formData();
		const email = (data.get('email') as string)?.trim().toLowerCase();
		const password = data.get('password') as string;

		if (!email || !password) {
			return fail(400, { error: 'Email and password are required.' });
		}

		const user = await findUserByEmail(email);
		if (!user || !verifyPassword(password, user.passwordHash)) {
			return fail(401, { error: 'Invalid email or password.' });
		}

		setSession(cookies, {
			userId: user.id,
			name: user.name,
			email: user.email,
			role: user.role,
		});

		redirect(302, '/');
	},
};
