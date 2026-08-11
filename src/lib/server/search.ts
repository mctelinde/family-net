import matter from 'gray-matter';
import lunr from 'lunr';
import type { Visibility, WidgetType } from '$lib/types';

interface SearchDoc {
	slug: string;
	title: string;
	type: WidgetType;
	owner: string;
	visibility: Visibility;
	tags: string[];
	updated: string;
	body: string;
}

export interface SearchResult {
	slug: string;
	title: string;
	type: WidgetType;
	visibility: Visibility;
	tags: string[];
	updated: string;
	score: number;
	snippet: string;
}

// ---------------------------------------------------------------------------
// Data loading
// ---------------------------------------------------------------------------

async function loadAllDocs(): Promise<SearchDoc[]> {
	const { readdir, readFile, mkdir } = await import('fs/promises');
	const { join } = await import('path');
	const dir = join(process.cwd(), 'data', 'entries');
	await mkdir(dir, { recursive: true });

	let files: string[];
	try {
		files = (await readdir(dir)).filter((f) => f.endsWith('.md'));
	} catch {
		return [];
	}

	const docs = await Promise.all(
		files.map(async (file) => {
			const slug = file.replace(/\.md$/, '');
			try {
				const raw = await readFile(join(dir, file), 'utf-8');
				const { data, content } = matter(raw);
				const doc: SearchDoc = {
					slug,
					title: (data.title as string) ?? slug,
					type: ((data.type as string) ?? 'note') as WidgetType,
					owner: (data.owner as string) ?? '',
					visibility: ((data.visibility as string) ?? 'family') as Visibility,
					tags: (data.tags as string[]) ?? [],
					updated: data.updated ? String(data.updated) : '',
					body: content,
				};
				return doc;
			} catch {
				return null;
			}
		})
	);

	return docs.filter((d): d is SearchDoc => d !== null);
}

// ---------------------------------------------------------------------------
// Index building (rebuilt per search — cheap at family-notebook scale)
// ---------------------------------------------------------------------------

function buildIndex(docs: SearchDoc[]): lunr.Index {
	return lunr(function (this: lunr.Builder) {
		this.ref('slug');
		this.field('title', { boost: 10 });
		this.field('tags', { boost: 5 });
		this.field('body');

		for (const doc of docs) {
			this.add({
				slug: doc.slug,
				title: doc.title,
				tags: doc.tags.join(' '),
				body: doc.body,
			});
		}
	});
}

function makeSnippet(body: string, terms: string[], length = 160): string {
	const plain = body
		.replace(/```[\s\S]*?```/g, ' ')
		.replace(/[#*_`>[\]()~-]/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
	if (!plain) return '';

	const lower = plain.toLowerCase();
	let idx = -1;
	for (const term of terms) {
		idx = lower.indexOf(term.toLowerCase());
		if (idx !== -1) break;
	}

	if (idx === -1) {
		return plain.length > length ? plain.slice(0, length).trim() + '…' : plain;
	}

	const start = Math.max(0, idx - 40);
	const end = Math.min(plain.length, start + length);
	return (start > 0 ? '…' : '') + plain.slice(start, end).trim() + (end < plain.length ? '…' : '');
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function search(
	query: string,
	userId: string,
	isAdmin: boolean
): Promise<SearchResult[]> {
	// Strip to alphanumeric terms so user input can't break lunr's query syntax
	// (lunr treats +, -, ~, ^, : and * as special query operators).
	const terms = query
		.split(/\s+/)
		.map((t) => t.replace(/[^\p{L}\p{N}]/gu, ''))
		.filter(Boolean);

	if (terms.length === 0) return [];

	const docs = await loadAllDocs();
	if (docs.length === 0) return [];

	const docsBySlug = new Map(docs.map((d) => [d.slug, d]));
	const index = buildIndex(docs);

	// Boost exact matches over prefix matches so "cake" outranks "cakewalk".
	const luQuery = terms.map((t) => `${t}^5 ${t}*^1`).join(' ');

	let hits: lunr.Index.Result[];
	try {
		hits = index.search(luQuery);
	} catch {
		hits = [];
	}

	return hits
		.map((hit) => {
			const doc = docsBySlug.get(hit.ref);
			if (!doc) return null;
			if (doc.visibility !== 'family' && doc.owner !== userId && !isAdmin) return null;
			return {
				slug: doc.slug,
				title: doc.title,
				type: doc.type,
				visibility: doc.visibility,
				tags: doc.tags,
				updated: doc.updated,
				score: hit.score,
				snippet: makeSnippet(doc.body, terms),
			} satisfies SearchResult;
		})
		.filter((r): r is SearchResult => r !== null);
}
