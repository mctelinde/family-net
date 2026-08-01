import { randomUUID } from 'crypto';
import type { User, UserRole } from '$lib/types';

// ---------------------------------------------------------------------------
// Filesystem backend
// ---------------------------------------------------------------------------

async function fsLoadUsers(): Promise<User[]> {
	const { readFile, mkdir } = await import('fs/promises');
	const { join } = await import('path');
	const dataDir = join(process.cwd(), 'data');
	await mkdir(dataDir, { recursive: true });
	try {
		const raw = await readFile(join(dataDir, 'users.json'), 'utf-8');
		return JSON.parse(raw) as User[];
	} catch {
		return [];
	}
}

async function fsSaveUsers(users: User[]): Promise<void> {
	const { writeFile, mkdir } = await import('fs/promises');
	const { join } = await import('path');
	const dataDir = join(process.cwd(), 'data');
	await mkdir(dataDir, { recursive: true });
	await writeFile(join(dataDir, 'users.json'), JSON.stringify(users, null, 2), 'utf-8');
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function loadUsers(): Promise<User[]> {
	return fsLoadUsers();
}

async function saveUsers(users: User[]): Promise<void> {
	return fsSaveUsers(users);
}

export async function findUserByEmail(email: string): Promise<User | null> {
	const users = await loadUsers();
	return users.find((u) => u.email.toLowerCase() === email.toLowerCase()) ?? null;
}

export async function findUserById(id: string): Promise<User | null> {
	const users = await loadUsers();
	return users.find((u) => u.id === id) ?? null;
}

export async function createUser(
	name: string,
	email: string,
	passwordHash: string,
	role: UserRole = 'member'
): Promise<User> {
	const users = await loadUsers();
	const user: User = { id: randomUUID(), name, email, passwordHash, role };
	users.push(user);
	await saveUsers(users);
	return user;
}

export async function hasAnyUsers(): Promise<boolean> {
	const users = await loadUsers();
	return users.length > 0;
}
