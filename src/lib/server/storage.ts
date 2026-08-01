import matter from 'gray-matter';
import { marked } from 'marked';
import type { NotebookEntry, NotebookEntryMeta, WidgetType, Visibility } from '$lib/types';

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function canAccess(
	entry: { owner: string; visibility: Visibility },
	userId: string,
	isAdmin: boolean
): boolean {
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

// ---------------------------------------------------------------------------
// Filesystem backend
// ---------------------------------------------------------------------------

async function fsGet(slug: string): Promise<string | null> {
	const { readFile } = await import('fs/promises');
	const { join } = await import('path');
	try {
		return await readFile(join(process.cwd(), 'data', 'entries', `${slug}.md`), 'utf-8');
	} catch {
		return null;
	}
}

async function fsPut(slug: string, content: string): Promise<void> {
	const { writeFile, mkdir } = await import('fs/promises');
	const { join } = await import('path');
	const dir = join(process.cwd(), 'data', 'entries');
	await mkdir(dir, { recursive: true });
	await writeFile(join(dir, `${slug}.md`), content, 'utf-8');
}

async function fsDel(slug: string): Promise<void> {
	const { unlink } = await import('fs/promises');
	const { join } = await import('path');
	await unlink(join(process.cwd(), 'data', 'entries', `${slug}.md`));
}

async function fsListSlugs(): Promise<string[]> {
	const { readdir, mkdir } = await import('fs/promises');
	const { join } = await import('path');
	const dir = join(process.cwd(), 'data', 'entries');
	await mkdir(dir, { recursive: true });
	try {
		const files = await readdir(dir);
		return files.filter((f) => f.endsWith('.md')).map((f) => f.replace(/\.md$/, ''));
	} catch {
		return [];
	}
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function listEntries(userId: string, isAdmin: boolean): Promise<NotebookEntryMeta[]> {
	const slugs = await fsListSlugs();
	const raws = (
		await Promise.all(
			slugs.map(async (slug) => {
				const raw = await fsGet(slug);
				return raw ? { slug, raw } : null;
			})
		)
	).filter((x): x is { slug: string; raw: string } => x !== null);

	return raws
		.map(({ slug, raw }) => {
			try {
				const { data } = matter(raw);
				return parseMeta(slug, data);
			} catch {
				return null;
			}
		})
		.filter((e): e is NotebookEntryMeta => e !== null && canAccess(e, userId, isAdmin))
		.sort((a, b) => b.updated.localeCompare(a.updated));
}

export async function readEntry(
	slug: string,
	userId: string,
	isAdmin: boolean
): Promise<NotebookEntry | null> {
	const raw = await fsGet(slug);
	if (!raw) return null;

	const { data, content } = matter(raw);
	const meta = parseMeta(slug, data);
	if (!canAccess(meta, userId, isAdmin)) return null;

	const body = await marked(content.trim());
	return { ...meta, body };
}

export async function writeEntry(
	slug: string,
	frontmatter: Record<string, unknown>,
	body: string
): Promise<void> {
	const updated = new Date().toISOString().slice(0, 10);
	const content = matter.stringify(body, { ...frontmatter, updated });
	await fsPut(slug, content);
}

export async function deleteEntry(slug: string): Promise<void> {
	await fsDel(slug);
}

export async function entryExists(slug: string): Promise<boolean> {
	return (await fsGet(slug)) !== null;
}
