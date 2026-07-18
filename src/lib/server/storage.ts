import { readFile, writeFile, readdir, unlink, mkdir } from 'fs/promises';
import { join } from 'path';
import matter from 'gray-matter';
import { marked } from 'marked';
import type { NotebookEntry, NotebookEntryMeta, WidgetType, Visibility } from '$lib/types';

const ENTRIES_DIR = join(process.cwd(), 'data', 'entries');

async function ensureDir(): Promise<void> {
	await mkdir(ENTRIES_DIR, { recursive: true });
}

function canAccess(entry: { owner: string; visibility: Visibility }, userId: string, isAdmin: boolean): boolean {
	return entry.visibility === 'family' || entry.owner === userId || isAdmin;
}

/**
 * Recursively convert Date objects to ISO date strings (YYYY-MM-DD) so the
 * data is safe to pass from SvelteKit server load functions to the client
 * and doesn't trip up devalue serialization.
 */
function serializeFrontmatter(obj: Record<string, unknown>): Record<string, unknown> {
	function walk(value: unknown): unknown {
		if (value instanceof Date) return value.toISOString().slice(0, 10);
		if (Array.isArray(value)) return value.map(walk);
		if (value !== null && typeof value === 'object') {
			return Object.fromEntries(
				Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, walk(v)])
			);
		}
		return value;
	}
	return walk(obj) as Record<string, unknown>;
}

function parseMeta(slug: string, data: Record<string, unknown>): NotebookEntryMeta {
	const safe = serializeFrontmatter(data);
	return {
		slug,
		title: (safe.title as string) ?? slug,
		type: ((safe.type as string) ?? 'note') as WidgetType,
		owner: (safe.owner as string) ?? '',
		visibility: ((safe.visibility as string) ?? 'family') as Visibility,
		tags: (safe.tags as string[]) ?? [],
		created: (safe.created as string) ?? '',
		updated: (safe.updated as string) ?? '',
		data: safe,
	};
}

export async function listEntries(userId: string, isAdmin: boolean): Promise<NotebookEntryMeta[]> {
	await ensureDir();
	let files: string[];
	try {
		files = await readdir(ENTRIES_DIR);
	} catch {
		return [];
	}

	const results = await Promise.all(
		files
			.filter((f) => f.endsWith('.md'))
			.map(async (file) => {
				try {
					const raw = await readFile(join(ENTRIES_DIR, file), 'utf-8');
					const { data } = matter(raw);
					const slug = file.replace(/\.md$/, '');
					return parseMeta(slug, data);
				} catch {
					return null;
				}
			})
	);

	return results
		.filter((e): e is NotebookEntryMeta => e !== null && canAccess(e, userId, isAdmin))
		.sort((a, b) => b.updated.localeCompare(a.updated));
}

export async function readEntry(slug: string, userId: string, isAdmin: boolean): Promise<NotebookEntry | null> {
	await ensureDir();
	try {
		const raw = await readFile(join(ENTRIES_DIR, `${slug}.md`), 'utf-8');
		const { data, content } = matter(raw);
		const meta = parseMeta(slug, data);

		if (!canAccess(meta, userId, isAdmin)) return null;

		const body = await marked(content.trim());
		return { ...meta, body };
	} catch {
		return null;
	}
}

export async function writeEntry(
	slug: string,
	frontmatter: Record<string, unknown>,
	body: string
): Promise<void> {
	await ensureDir();
	const updated = new Date().toISOString().slice(0, 10);
	const stringified = matter.stringify(body, { ...frontmatter, updated });
	await writeFile(join(ENTRIES_DIR, `${slug}.md`), stringified, 'utf-8');
}

export async function deleteEntry(slug: string): Promise<void> {
	await ensureDir();
	await unlink(join(ENTRIES_DIR, `${slug}.md`));
}

export async function entryExists(slug: string): Promise<boolean> {
	try {
		await readFile(join(ENTRIES_DIR, `${slug}.md`), 'utf-8');
		return true;
	} catch {
		return false;
	}
}
