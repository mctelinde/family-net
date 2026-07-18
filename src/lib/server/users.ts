import { readFile, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { randomUUID } from 'crypto';
import type { User, UserRole } from '$lib/types';

const DATA_DIR = join(process.cwd(), 'data');
const USERS_FILE = join(DATA_DIR, 'users.json');

async function ensureDir(): Promise<void> {
	await mkdir(DATA_DIR, { recursive: true });
}

export async function loadUsers(): Promise<User[]> {
	await ensureDir();
	try {
		const raw = await readFile(USERS_FILE, 'utf-8');
		return JSON.parse(raw) as User[];
	} catch {
		return [];
	}
}

async function saveUsers(users: User[]): Promise<void> {
	await ensureDir();
	await writeFile(USERS_FILE, JSON.stringify(users, null, 2), 'utf-8');
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
