/** Convert a title to a URL-safe slug */
export function slugify(title: string): string {
	return title
		.toLowerCase()
		.replace(/[^a-z0-9\s-]/g, '')
		.trim()
		.replace(/\s+/g, '-')
		.replace(/-+/g, '-');
}

const headingPattern = /^(#{1,6})\s+(.*)$/;
const unorderedListPattern = /^\s*-\s+(.*)$/;
const orderedListPattern = /^\s*\d+\.\s+(.*)$/;

function escapeHtml(value: string): string {
	return value
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&#39;');
}

function sanitizeUrl(url: string): string | null {
	const trimmed = url.trim();

	if (!trimmed) {
		return null;
	}

	if (trimmed.startsWith('/') || trimmed.startsWith('#')) {
		return escapeHtml(trimmed);
	}

	try {
		const parsed = new URL(trimmed);
		const protocol = parsed.protocol.toLowerCase();

		if (protocol === 'http:' || protocol === 'https:' || protocol === 'mailto:') {
			return escapeHtml(trimmed);
		}
	} catch {
		return null;
	}

	return null;
}

function applyInlineFormatting(content: string): string {
	return content
		.replace(/`([^`]+)`/g, '<code>$1</code>')
		.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
		.replace(/\*([^*]+)\*/g, '<em>$1</em>');
}

function renderInline(content: string): string {
	const linkPattern = /\[([^\]]+)\]\(([^)]+)\)/g;
	let html = '';
	let cursor = 0;

	for (const match of content.matchAll(linkPattern)) {
		const fullMatch = match[0];
		const text = match[1];
		const url = match[2];
		const matchIndex = match.index ?? 0;

		html += applyInlineFormatting(escapeHtml(content.slice(cursor, matchIndex)));

		const safeUrl = sanitizeUrl(url);
		const safeText = applyInlineFormatting(escapeHtml(text));

		if (safeUrl) {
			html += `<a href="${safeUrl}" rel="noopener noreferrer" target="_blank">${safeText}</a>`;
		} else {
			html += safeText;
		}

		cursor = matchIndex + fullMatch.length;
	}

	html += applyInlineFormatting(escapeHtml(content.slice(cursor)));

	return html;
}

export function renderMarkdown(markdown: string): string {
	const lines = markdown.split(/\r?\n/);
	const html: string[] = [];
	let paragraph: string[] = [];
	let inUnorderedList = false;
	let inOrderedList = false;

	const flushParagraph = () => {
		if (paragraph.length > 0) {
			html.push(`<p>${renderInline(paragraph.join(' '))}</p>`);
			paragraph = [];
		}
	};

	const closeLists = () => {
		if (inUnorderedList) {
			html.push('</ul>');
			inUnorderedList = false;
		}

		if (inOrderedList) {
			html.push('</ol>');
			inOrderedList = false;
		}
	};

	for (const line of lines) {
		const trimmed = line.trim();

		if (!trimmed) {
			flushParagraph();
			closeLists();
			continue;
		}

		const headingMatch = trimmed.match(headingPattern);
		if (headingMatch) {
			flushParagraph();
			closeLists();
			const level = headingMatch[1].length;
			html.push(`<h${level}>${renderInline(headingMatch[2])}</h${level}>`);
			continue;
		}

		const unorderedListMatch = trimmed.match(unorderedListPattern);
		if (unorderedListMatch) {
			flushParagraph();
			if (inOrderedList) {
				html.push('</ol>');
				inOrderedList = false;
			}
			if (!inUnorderedList) {
				html.push('<ul>');
				inUnorderedList = true;
			}
			html.push(`<li>${renderInline(unorderedListMatch[1])}</li>`);
			continue;
		}

		const orderedListMatch = trimmed.match(orderedListPattern);
		if (orderedListMatch) {
			flushParagraph();
			if (inUnorderedList) {
				html.push('</ul>');
				inUnorderedList = false;
			}
			if (!inOrderedList) {
				html.push('<ol>');
				inOrderedList = true;
			}
			html.push(`<li>${renderInline(orderedListMatch[1])}</li>`);
			continue;
		}

		closeLists();
		paragraph.push(trimmed);
	}

	flushParagraph();
	closeLists();

	return html.join('\n');
}
