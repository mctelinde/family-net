<script lang="ts">
	import type { PageData } from './$types';

	const TYPE_LABELS: Record<string, string> = {
		'note': 'Note',
		'business-plan': 'Business Plan',
		'fitness-goals': 'Fitness Goals',
		'finance-tracker': 'Finance Tracker',
	};

	const TYPE_COLORS: Record<string, { bg: string; text: string }> = {
		'note':             { bg: '#f0eff9', text: '#4f46e5' },
		'business-plan':   { bg: '#1a1a2e', text: '#fff' },
		'fitness-goals':   { bg: '#dcfce7', text: '#16a34a' },
		'finance-tracker': { bg: '#eff6ff', text: '#2563eb' },
	};

	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>Family Net</title>
</svelte:head>

<div class="page">
	<header class="page-header">
		<h1>Notebook</h1>
		<p class="subtitle">
			{data.entries.length} {data.entries.length === 1 ? 'entry' : 'entries'} · maintained by agents
		</p>
	</header>

	{#if data.entries.length === 0}
		<div class="empty">
			<p>No notebook entries yet.</p>
			<p class="hint">
				Use the <a href="/api/tools?format=openapi" target="_blank">agent API</a>
				or POST to <code>/api/notebook</code> to create the first entry.
			</p>
		</div>
	{:else}
		<div class="grid">
			{#each data.entries as entry}
				{@const color = TYPE_COLORS[entry.type] ?? TYPE_COLORS['note']}
				<a href="/notebook/{entry.slug}" class="card">
					<div class="card-top">
						<span class="type-badge" style="background: {color.bg}; color: {color.text}">
							{TYPE_LABELS[entry.type] ?? entry.type}
						</span>
						{#if entry.visibility === 'private'}
							<span class="private-badge" title="Private">🔒</span>
						{/if}
					</div>
					<h2 class="card-title">{entry.title}</h2>
					{#if entry.tags.length}
						<div class="card-tags">
							{#each entry.tags.slice(0, 3) as tag}
								<span class="tag">{tag}</span>
							{/each}
						</div>
					{/if}
					<p class="card-meta">Updated {entry.updated}</p>
				</a>
			{/each}
		</div>
	{/if}
</div>

<style>
	.page { width: 100%; }
	.page-header { margin-bottom: 2rem; }
	h1 { margin: 0 0 0.25rem; font-size: clamp(1.5rem, 3vw, 2rem); font-weight: 700; }
	.subtitle { margin: 0; color: #9b9baa; font-size: 0.875rem; }
	.empty { background: #fafaf8; border: 1px dashed #d4d2cc; border-radius: 12px; padding: 3rem 2rem; text-align: center; color: #6b6b80; }
	.empty p { margin: 0 0 0.5rem; }
	.hint { font-size: 0.875rem; }
	.hint a { color: #4f46e5; }
	.hint code { background: #f0eff9; padding: 0.1em 0.3em; border-radius: 4px; font-size: 0.875em; }
	.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 1rem; }
	.card { display: flex; flex-direction: column; gap: 0.5rem; background: #fff; border: 1px solid #e5e3de; border-radius: 12px; padding: 1.25rem; text-decoration: none; color: inherit; transition: box-shadow 0.15s, border-color 0.15s; }
	.card:hover { box-shadow: 0 4px 16px rgba(0,0,0,0.08); border-color: #c4c4cf; }
	.card-top { display: flex; align-items: center; justify-content: space-between; }
	.type-badge { font-size: 0.68rem; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; padding: 0.2rem 0.55rem; border-radius: 4px; }
	.private-badge { font-size: 0.75rem; }
	.card-title { margin: 0; font-size: 1rem; font-weight: 700; color: #1a1a2e; line-height: 1.3; }
	.card-tags { display: flex; flex-wrap: wrap; gap: 0.3rem; }
	.tag { padding: 0.15rem 0.5rem; background: #f0eff9; color: #6b6b80; border-radius: 99px; font-size: 0.72rem; }
	.card-meta { margin: 0; font-size: 0.75rem; color: #c4c4cf; margin-top: auto; padding-top: 0.25rem; }
</style>
