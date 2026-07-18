<script lang="ts">
	import type { NotebookEntry } from '$lib/types';

	interface Milestone {
		name: string;
		status: 'done' | 'in-progress' | 'planned';
		date?: string;
	}

	let { entry }: { entry: NotebookEntry } = $props();

	const data = $derived(entry.data as {
		mission?: string;
		stage?: string;
		milestones?: Milestone[];
	});

	const statusColors: Record<string, string> = {
		'done': '#22c55e',
		'in-progress': '#f59e0b',
		'planned': '#cbd5e1',
	};
</script>

<article class="widget-bp">
	<header>
		<div class="title-row">
			<span class="badge">Business Plan</span>
			{#if data.stage}
				<span class="stage">{data.stage}</span>
			{/if}
		</div>
		<h1>{entry.title}</h1>
		{#if data.mission}
			<p class="mission">{data.mission}</p>
		{/if}
		{#if entry.tags.length}
			<div class="tags">
				{#each entry.tags as tag}
					<span class="tag">{tag}</span>
				{/each}
			</div>
		{/if}
		<p class="meta">Updated {entry.updated}</p>
	</header>

	{#if data.milestones?.length}
		<section class="milestones">
			<h2>Milestones</h2>
			<ul>
				{#each data.milestones as m}
					<li class="milestone">
						<span
							class="dot"
							style="background: {statusColors[m.status] ?? '#cbd5e1'}"
							title={m.status}
						></span>
						<span class="milestone-name">{m.name}</span>
						{#if m.date}
							<span class="milestone-date">{m.date}</span>
						{/if}
					</li>
				{/each}
			</ul>
		</section>
	{/if}

	{#if entry.body}
		<div class="body prose">{@html entry.body}</div>
	{/if}
</article>

<style>
	.widget-bp { max-width: 720px; }

	header {
		margin-bottom: 2rem;
		padding-bottom: 1.25rem;
		border-bottom: 1px solid #e5e3de;
	}

	.title-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-bottom: 0.5rem;
	}

	.badge {
		background: #1a1a2e;
		color: #fff;
		font-size: 0.7rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		padding: 0.2rem 0.55rem;
		border-radius: 4px;
	}

	.stage {
		font-size: 0.75rem;
		color: #6b6b80;
		font-weight: 600;
	}

	h1 { margin: 0 0 0.5rem; font-size: clamp(1.4rem, 3vw, 2rem); font-weight: 700; color: #1a1a2e; }

	.mission {
		margin: 0 0 0.75rem;
		color: #3d3d4d;
		font-size: 1rem;
		font-style: italic;
		line-height: 1.5;
	}

	.tags { display: flex; flex-wrap: wrap; gap: 0.4rem; margin-bottom: 0.5rem; }
	.tag { padding: 0.2rem 0.6rem; background: #eff6ff; color: #2563eb; border-radius: 99px; font-size: 0.75rem; font-weight: 600; }
	.meta { margin: 0; font-size: 0.8rem; color: #9b9baa; }

	.milestones { margin-bottom: 1.75rem; }
	.milestones h2 { font-size: 0.85rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #9b9baa; margin: 0 0 0.75rem; }

	ul { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 0.5rem; }

	.milestone {
		display: flex;
		align-items: center;
		gap: 0.65rem;
		padding: 0.6rem 0.85rem;
		background: #fafaf8;
		border: 1px solid #e5e3de;
		border-radius: 8px;
	}

	.dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
	.milestone-name { flex: 1; font-size: 0.9rem; color: #1a1a2e; }
	.milestone-date { font-size: 0.78rem; color: #9b9baa; }
</style>
