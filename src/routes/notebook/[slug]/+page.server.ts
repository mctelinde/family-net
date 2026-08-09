import { error, redirect } from '@sveltejs/kit';
import { readEntry, writeEntry } from '$lib/server/storage';
import type { PageServerLoad, Actions } from './$types';

export const load: PageServerLoad = async ({ params, locals }) => {
	if (!locals.user) redirect(302, '/login');
	const entry = await readEntry(params.slug, locals.user.userId, locals.user.role === 'admin');
	if (!entry) error(404, 'Entry not found');
	return { entry };
};

export const actions: Actions = {
	updateTodos: async ({ request, params, locals }) => {
		if (!locals.user) return error(401, 'Unauthorized');

		try {
			const formData = await request.formData();
			const itemsJson = formData.get('items');

			if (!itemsJson || typeof itemsJson !== 'string') {
				return error(400, 'Invalid items data');
			}

			const items = JSON.parse(itemsJson);

			// Read existing entry to preserve all fields
			const existing = await readEntry(
				params.slug,
				locals.user.userId,
				locals.user.role === 'admin'
			);

			if (!existing) {
				return error(404, 'Entry not found');
			}

			// Update the frontmatter with new items
			const updatedFrontmatter = {
				...(existing.data as Record<string, unknown>),
				items,
			};

			// Write the updated entry
			await writeEntry(params.slug, updatedFrontmatter, existing.body);

			return { success: true };
		} catch (err) {
			console.error('Error updating todos:', err);
			return error(500, 'Failed to update todos');
		}
	},
};

