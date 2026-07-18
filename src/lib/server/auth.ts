import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'crypto';
import type { Cookies } from '@sveltejs/kit';
import type { AuthSession } from '$lib/types';
import { env } from '$env/dynamic/private';

function getSecret(): string {
	const secret = env.SESSION_SECRET;
	if (!secret) throw new Error('SESSION_SECRET environment variable is not set.');
	return secret;
}

const COOKIE_NAME = 'fn_session';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

function sign(payload: string): string {
	return createHmac('sha256', getSecret()).update(payload).digest('base64url');
}

export function createToken(session: AuthSession): string {
	const payload = Buffer.from(JSON.stringify(session)).toString('base64url');
	return `${payload}.${sign(payload)}`;
}

export function verifyToken(token: string): AuthSession | null {
	const dot = token.lastIndexOf('.');
	if (dot === -1) return null;

	const payload = token.slice(0, dot);
	const sig = token.slice(dot + 1);

	try {
		const expected = Buffer.from(sign(payload), 'base64url');
		const received = Buffer.from(sig, 'base64url');
		if (expected.length !== received.length) return null;
		if (!timingSafeEqual(expected, received)) return null;

		const data = JSON.parse(Buffer.from(payload, 'base64url').toString()) as AuthSession;
		if (data.exp && Date.now() > data.exp) return null;
		return data;
	} catch {
		return null;
	}
}

export function hashPassword(password: string): string {
	const salt = randomBytes(16).toString('hex');
	const hash = scryptSync(password, salt, 64) as Buffer;
	return `${salt}:${hash.toString('hex')}`;
}

export function verifyPassword(password: string, stored: string): boolean {
	const [salt, hashHex] = stored.split(':');
	if (!salt || !hashHex) return false;
	try {
		const storedBuf = Buffer.from(hashHex, 'hex');
		const derived = scryptSync(password, salt, 64) as Buffer;
		return timingSafeEqual(storedBuf, derived);
	} catch {
		return false;
	}
}

export function getSession(cookies: Cookies): AuthSession | null {
	const raw = cookies.get(COOKIE_NAME);
	if (!raw) return null;
	return verifyToken(raw);
}

export function setSession(cookies: Cookies, session: Omit<AuthSession, 'exp'>): void {
	const full: AuthSession = { ...session, exp: Date.now() + COOKIE_MAX_AGE * 1000 };
	cookies.set(COOKIE_NAME, createToken(full), {
		httpOnly: true,
		secure: process.env.NODE_ENV === 'production',
		sameSite: 'lax',
		maxAge: COOKIE_MAX_AGE,
		path: '/'
	});
}

export function clearSession(cookies: Cookies): void {
	cookies.delete(COOKIE_NAME, { path: '/' });
}

export function verifyApiKey(request: Request): boolean {
	const key = env.AGENT_API_KEY;
	if (!key) return false;
	const auth = request.headers.get('authorization');
	return auth === `Bearer ${key}`;
}
