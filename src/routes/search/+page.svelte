<script lang="ts">
	import type { PageData } from './$types';

	const TYPE_LABELS: Record<string, string> = {
		'note': 'Note',
		'business-plan': 'Business Plan',
		'fitness-goals': 'Fitness Goals',
		'finance-tracker': 'Finance Tracker',
		'todo-list': 'Todo List',
	};

	let { data }: { data: PageData } = $props();

	let queryInput = $state(data.query);

	$effect(() => {
		queryInput = data.query;
	});

	function submitSearch(e: SubmitEvent) {
		e.preventDefault();
		const q = queryInput.trim();
		const url = q ? `/search?q=${encodeURIComponent(q)}` : '/search';
		window.location.href = url;
	}
</script>

<svelte:head>
	<title>Search — TeliNet</title>
</svelte:head>

<div class="page">
	<header class="page-header">
		<h1>Search</h1>
		<form class="search-form" onsubmit={submitSearch}>
			<input
				type="search"
				name="q"
				placeholder="Search notebook entries…"
				bind:value={queryInput}
				autofocus
			/>
			<button type="submit">Search</button>
		</form>
	</header>

	{#if !data.query}
		<p class="hint">Enter a search term to find notebook entries by title, tags, or content.</p>
	{:else if data.results.length === 0}
		<div class="empty">
			<p>No entries found for "{data.query}".</p>
		</div>
	{:else}
		<p class="subtitle">
			{data.results.length} {data.results.length === 1 ? 'result' : 'results'} for "{data.query}"
		</p>
		<div class="results">
			{#each data.results as result}
				<a href="/notebook/{result.slug}" class="result-card">
					<div class="result-top">
						<span class="type-badge">{TYPE_LABELS[result.type] ?? result.type}</span>
						{#if result.visibility === 'private'}
							<span class="private-badge" title="Private">🔒</span>
						{/if}
					</div>
					<h2 class="result-title">{result.title}</h2>
					{#if result.snippet}
						<p class="result-snippet">{result.snippet}</p>
					{/if}
					{#if result.tags.length}
						<div class="result-tags">
							{#each result.tags.slice(0, 5) as tag}
								<span class="tag">{tag}</span>
							{/each}
						</div>
					{/if}
				</a>
			{/each}
		</div>
	{/if}
</div>

<style>
	.page { width: 100%; }
	.page-header { margin-bottom: 1.5rem; }
	h1 { margin: 0 0 1rem; font-size: clamp(1.5rem, 3vw, 2rem); font-weight: 700; }
	.search-form { display: flex; gap: 0.5rem; max-width: 480px; }
	.search-form input { flex: 1; padding: 0.55rem 0.8rem; border: 1px solid var(--border-strong); border-radius: 8px; font-size: 0.9rem; background: var(--surface); color: var(--text-primary); }
	.search-form button { padding: 0.55rem 1rem; border: none; border-radius: 8px; background: var(--accent); color: #fff; font-size: 0.9rem; font-weight: 600; cursor: pointer; }
	.search-form button:hover { background: var(--accent-hover); }
	.subtitle { margin: 0 0 1rem; color: var(--text-muted); font-size: 0.875rem; }
	.hint { color: var(--text-tertiary); font-size: 0.9rem; }
	.empty { background: var(--surface-alt); border: 1px dashed var(--border-strong); border-radius: 12px; padding: 2rem; text-align: center; color: var(--text-tertiary); }
	.results { display: flex; flex-direction: column; gap: 0.75rem; }
	.result-card { display: flex; flex-direction: column; gap: 0.4rem; background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 1.1rem 1.25rem; text-decoration: none; color: inherit; transition: box-shadow 0.15s, border-color 0.15s; }
	.result-card:hover { box-shadow: 0 4px 16px var(--shadow-color-strong); border-color: var(--border-strong); }
	.result-top { display: flex; align-items: center; justify-content: space-between; }
	.type-badge { font-size: 0.68rem; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; padding: 0.2rem 0.55rem; border-radius: 4px; background: var(--accent-soft-bg); color: var(--accent); }
	.private-badge { font-size: 0.75rem; }
	.result-title { margin: 0; font-size: 1.05rem; font-weight: 700; color: var(--text-primary); }
	.result-snippet { margin: 0; font-size: 0.85rem; color: var(--text-tertiary); line-height: 1.5; }
	.result-tags { display: flex; flex-wrap: wrap; gap: 0.3rem; }
	.tag { padding: 0.15rem 0.5rem; background: var(--accent-soft-bg); color: var(--text-tertiary); border-radius: 99px; font-size: 0.72rem; }
</style>
