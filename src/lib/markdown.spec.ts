import { describe, expect, it } from 'vitest';
import { renderMarkdown } from './markdown';

describe('renderMarkdown', () => {
	it('renders basic markdown sections', () => {
		const html = renderMarkdown('# Title\n\n- One\n- Two');

		expect(html).toContain('<h1>Title</h1>');
		expect(html).toContain('<ul>');
		expect(html).toContain('<li>One</li>');
		expect(html).toContain('<li>Two</li>');
	});

	it('escapes unsafe markup', () => {
		const html = renderMarkdown('Hello <script>alert(1)</script>');

		expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
		expect(html).not.toContain('<script>');
	});

	it('drops unsafe links', () => {
		const html = renderMarkdown('[click](javascript:evil)');

		expect(html).toContain('<p>click</p>');
		expect(html).not.toContain('javascript:');
	});
});
