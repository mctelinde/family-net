import { env } from '$env/dynamic/private';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = () => {
	// Available in production too — the dangerous tools (read_file etc.) are
	// still gated on ENABLE_DEV_TOOLS in /api/chat, so exposing the UI here
	// doesn't widen the attack surface beyond the chat stream itself.
	return {
		apiKey: env.AGENT_API_KEY ?? '',
		devToolsEnabled: env.ENABLE_DEV_TOOLS === 'true',
	};
};
