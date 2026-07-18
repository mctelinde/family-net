<script lang="ts">
	import type { NotebookEntry } from '$lib/types';

	interface BudgetLine {
		category: string;
		allocated: number;
		spent: number;
	}

	let { entry }: { entry: NotebookEntry } = $props();

	const data = $derived(entry.data as {
		currency?: string;
		period?: string;
		budget?: BudgetLine[];
	});

	const currency = $derived(data.currency ?? '$');

	function fmt(n: number): string {
		return currency + n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
	}

	function pct(spent: number, allocated: number): number {
		return Math.min(100, Math.round((spent / allocated) * 100));
	}

	const totalAllocated = $derived((data.budget ?? []).reduce((s, l) => s + l.allocated, 0));
	const totalSpent = $derived((data.budget ?? []).reduce((s, l) => s + l.spent, 0));
</script>

<article class="widget-finance">
	<header>
		<div class="title-row">
			<span class="badge">Finance Tracker</span>
			{#if data.period}
				<span class="period">{data.period}</span>
			{/if}
		</div>
		<h1>{entry.title}</h1>
		{#if entry.tags.length}
			<div class="tags">
				{#each entry.tags as tag}<span class="tag">{tag}</span>{/each}
			</div>
		{/if}
		<p class="meta">Updated {entry.updated}</p>
	</header>

	{#if data.budget?.length}
		<section class="summary">
			<div class="summary-card">
				<span class="label">Total Budget</span>
				<span class="value">{fmt(totalAllocated)}</span>
			</div>
			<div class="summary-card {totalSpent > totalAllocated ? 'over' : ''}">
				<span class="label">Spent</span>
				<span class="value">{fmt(totalSpent)}</span>
			</div>
			<div class="summary-card remaining">
				<span class="label">Remaining</span>
				<span class="value">{fmt(totalAllocated - totalSpent)}</span>
			</div>
		</section>

		<section class="budget-lines">
			<h2>Breakdown</h2>
			{#each data.budget as line}
				{@const p = pct(line.spent, line.allocated)}
				<div class="line">
					<div class="line-top">
						<span class="cat">{line.category}</span>
						<span class="amounts">{fmt(line.spent)} <span class="of">of</span> {fmt(line.allocated)}</span>
					</div>
					<div class="bar-track">
						<div
							class="bar-fill"
							style="width: {p}%; background: {p > 100 ? '#ef4444' : p > 85 ? '#f59e0b' : '#4f46e5'}"
						></div>
					</div>
				</div>
			{/each}
		</section>
	{/if}

	{#if entry.body}
		<div class="body prose">{@html entry.body}</div>
	{/if}
</article>

<style>
	.widget-finance { max-width: 720px; }

	header { margin-bottom: 2rem; padding-bottom: 1.25rem; border-bottom: 1px solid #e5e3de; }
	.title-row { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.4rem; }

	.badge {
		background: #eff6ff;
		color: #2563eb;
		font-size: 0.7rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		padding: 0.2rem 0.55rem;
		border-radius: 4px;
	}

	.period { font-size: 0.75rem; color: #6b6b80; font-weight: 600; }
	h1 { margin: 0 0 0.5rem; font-size: clamp(1.4rem, 3vw, 2rem); font-weight: 700; color: #1a1a2e; }
	.tags { display: flex; flex-wrap: wrap; gap: 0.4rem; margin-bottom: 0.5rem; }
	.tag { padding: 0.2rem 0.6rem; background: #eff6ff; color: #2563eb; border-radius: 99px; font-size: 0.75rem; font-weight: 600; }
	.meta { margin: 0; font-size: 0.8rem; color: #9b9baa; }

	.summary {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 0.75rem;
		margin-bottom: 1.75rem;
	}

	.summary-card {
		background: #fafaf8;
		border: 1px solid #e5e3de;
		border-radius: 10px;
		padding: 0.85rem 1rem;
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
	}

	.summary-card.over { border-color: #fca5a5; background: #fff1f0; }
	.summary-card.remaining { border-color: #bbf7d0; background: #f0fdf4; }
	.label { font-size: 0.75rem; color: #9b9baa; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; }
	.value { font-size: 1.2rem; font-weight: 700; color: #1a1a2e; }

	.budget-lines { margin-bottom: 1.75rem; }
	.budget-lines h2 { font-size: 0.85rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #9b9baa; margin: 0 0 0.75rem; }

	.line {
		margin-bottom: 0.9rem;
	}

	.line-top { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 0.4rem; }
	.cat { font-weight: 600; color: #1a1a2e; font-size: 0.875rem; }
	.amounts { font-size: 0.82rem; color: #6b6b80; }
	.of { color: #c4c4cf; margin: 0 0.2em; }

	.bar-track { height: 8px; background: #e5e3de; border-radius: 99px; overflow: hidden; }
	.bar-fill { height: 100%; border-radius: 99px; transition: width 0.4s; }
</style>
