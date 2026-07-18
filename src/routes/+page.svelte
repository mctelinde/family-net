<script lang="ts">
	import { renderMarkdown } from '$lib/markdown';

	const starterMarkdown = `# Family Notebook

## Shared priorities
- Build a healthy weekly routine
- Track appointments and commitments
- Keep long-term plans visible

## Venture planning
1. Validate the software company idea
2. Define product milestones
3. Plan first customer interviews`;

	let markdown = $state(starterMarkdown);
	let notebookHtml = $derived(renderMarkdown(markdown));

	function exportNotebook(): void {
		const documentHtml = `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Family Notebook Export</title>
<style>
body { font-family: Inter, system-ui, sans-serif; margin: 0; padding: 2rem; background: #f8fafc; color: #0f172a; }
main { max-width: 840px; margin: 0 auto; background: white; border-radius: 16px; padding: 2rem; box-shadow: 0 8px 24px rgba(15, 23, 42, 0.08); }
h1, h2, h3, h4, h5, h6 { margin-top: 1.5rem; }
code { background: #f1f5f9; border-radius: 6px; padding: 0.15rem 0.35rem; }
a { color: #2563eb; }
</style>
</head>
<body>
	<main>${notebookHtml}</main>
</body>
</html>`;

		const blob = new Blob([documentHtml], { type: 'text/html;charset=utf-8' });
		const url = URL.createObjectURL(blob);
		const anchor = document.createElement('a');
		anchor.href = url;
		anchor.download = 'family-notebook.html';
		anchor.click();
		URL.revokeObjectURL(url);
	}
</script>

<svelte:head>
	<title>Family Net Notebook</title>
	<meta
		name="description"
		content="Write secure markdown and export it as a clean family planning notebook."
	/>
</svelte:head>

<main>
	<header>
		<h1>Family Net</h1>
		<p>Write markdown first, then view it as a modern notebook and export it for sharing.</p>
	</header>

	<section class="workspace">
		<article>
			<div class="section-header">
				<h2>Markdown</h2>
				<button type="button" onclick={exportNotebook}>Export HTML</button>
			</div>
			<label class="sr-only" for="notebook-markdown">Family notebook markdown</label>
			<textarea id="notebook-markdown" bind:value={markdown} spellcheck="true" autocomplete="off"></textarea>
		</article>

		<article>
			<h2>Notebook preview</h2>
			<div class="preview" aria-live="polite">
				{@html notebookHtml}
			</div>
		</article>
	</section>
</main>

<style>
	:global(body) {
		margin: 0;
		font-family:
			Inter,
			system-ui,
			-apple-system,
			BlinkMacSystemFont,
			'Segoe UI',
			sans-serif;
		background: linear-gradient(180deg, #f8fafc 0%, #eef2ff 100%);
		color: #0f172a;
	}

	main {
		max-width: 1100px;
		margin: 0 auto;
		padding: 2rem 1rem 3rem;
	}

	header {
		margin-bottom: 1.5rem;
	}

	h1 {
		margin: 0;
		font-size: clamp(1.8rem, 4vw, 2.5rem);
	}

	p {
		margin: 0.6rem 0 0;
		color: #334155;
	}

	.workspace {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
		gap: 1rem;
	}

	article {
		background: #ffffff;
		border: 1px solid #dbeafe;
		border-radius: 16px;
		padding: 1rem;
		box-shadow: 0 6px 18px rgba(15, 23, 42, 0.08);
	}

	.section-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
	}

	h2 {
		margin: 0 0 0.75rem;
		font-size: 1.1rem;
	}

	button {
		border: none;
		background: #2563eb;
		color: white;
		padding: 0.55rem 0.9rem;
		border-radius: 10px;
		font-weight: 600;
		cursor: pointer;
	}

	button:hover {
		background: #1d4ed8;
	}

	textarea {
		width: 100%;
		min-height: 460px;
		border: 1px solid #cbd5e1;
		border-radius: 12px;
		padding: 0.9rem;
		font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', monospace;
		font-size: 0.95rem;
		line-height: 1.45;
		box-sizing: border-box;
		resize: vertical;
	}

	.preview {
		min-height: 460px;
		border-radius: 12px;
		border: 1px solid #cbd5e1;
		padding: 1rem;
		background: #fcfdff;
	}

	.preview :global(h1),
	.preview :global(h2),
	.preview :global(h3),
	.preview :global(h4),
	.preview :global(h5),
	.preview :global(h6) {
		margin-top: 1rem;
		margin-bottom: 0.5rem;
	}

	.preview :global(p) {
		margin: 0.5rem 0;
		color: #0f172a;
	}

	.preview :global(ul),
	.preview :global(ol) {
		margin: 0.5rem 0 0.75rem 1.2rem;
	}

	.preview :global(code) {
		background: #e2e8f0;
		border-radius: 6px;
		padding: 0.1rem 0.3rem;
	}

	.preview :global(a) {
		color: #1d4ed8;
	}

	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}
</style>
