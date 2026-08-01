import { dev } from '$app/environment';
import { error } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = () => {
	if (!dev) error(404, 'Not found');
	return {
		apiKey: env.AGENT_API_KEY ?? '',
		devToolsEnabled: env.ENABLE_DEV_TOOLS === 'true',
	};
};
