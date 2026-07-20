import { randomUUID } from 'crypto';
import { env } from '$env/dynamic/private';
import type { User, UserRole } from '$lib/types';

const USERS_BLOB_PATH = 'data/users.json';

// ---------------------------------------------------------------------------
// Backend detection
// ---------------------------------------------------------------------------

function useBlob(): boolean {
	return !!env.BLOB_READ_WRITE_TOKEN;
}

// ---------------------------------------------------------------------------
// Vercel Blob backend
// ---------------------------------------------------------------------------

async function blobLoadUsers(): Promise<User[]> {
	const { list } = await import('@vercel/blob');
	const { blobs } = await list({ prefix: USERS_BLOB_PATH, token: env.BLOB_READ_WRITE_TOKEN });
	const match = blobs.find((b) => b.pathname === USERS_BLOB_PATH);
	if (!match) return [];
	const res = await fetch(match.downloadUrl);
	if (!res.ok) return [];
	return res.json() as Promise<User[]>;
}

async function blobSaveUsers(users: User[]): Promise<void> {
	const { put } = await import('@vercel/blob');
	await put(USERS_BLOB_PATH, JSON.stringify(users, null, 2), {
		access: 'private',
		addRandomSuffix: false,
		token: env.BLOB_READ_WRITE_TOKEN,
	});
}

// ---------------------------------------------------------------------------
// Local filesystem backend
// ---------------------------------------------------------------------------

async function fsLoadUsers(): Promise<User[]> {
	const { readFile, mkdir } = await import('fs/promises');
	const { join } = await import('path');
	const dataDir = join(process.cwd(), 'data');
	try {
		await mkdir(dataDir, { recursive: true });
	} catch {
		// read-only fs (e.g. Vercel) — attempt read anyway
	}
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
	return useBlob() ? blobLoadUsers() : fsLoadUsers();
}

async function saveUsers(users: User[]): Promise<void> {
	return useBlob() ? blobSaveUsers(users) : fsSaveUsers(users);
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
