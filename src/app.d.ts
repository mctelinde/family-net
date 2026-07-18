import type { AuthSession } from '$lib/types';

declare global {
	namespace App {
		interface Locals {
			user: AuthSession | null;
		}
	}
}

export {};
