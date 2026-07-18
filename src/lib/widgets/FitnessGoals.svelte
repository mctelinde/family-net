<script lang="ts">
	import type { NotebookEntry } from '$lib/types';

	interface Goal {
		name: string;
		target: number;
		current: number;
		unit: string;
		deadline?: string;
	}

	let { entry }: { entry: NotebookEntry } = $props();

	const data = $derived(entry.data as { goals?: Goal[] });

	function pct(current: number, target: number): number {
		return Math.min(100, Math.round((current / target) * 100));
	}
</script>

<article class="widget-fitness">
	<header>
		<span class="badge">Fitness Goals</span>
		<h1>{entry.title}</h1>
		{#if entry.tags.length}
			<div class="tags">
				{#each entry.tags as tag}<span class="tag">{tag}</span>{/each}
			</div>
		{/if}
		<p class="meta">Updated {entry.updated}</p>
	</header>

	{#if data.goals?.length}
		<section class="goals">
			<h2>Goals</h2>
			{#each data.goals as goal}
				{@const p = pct(goal.current, goal.target)}
				<div class="goal-card">
					<div class="goal-top">
						<span class="goal-name">{goal.name}</span>
						<span class="goal-value">
							{goal.current} / {goal.target} {goal.unit}
						</span>
					</div>
					<div class="bar-track">
						<div
							class="bar-fill"
							style="width: {p}%; background: {p >= 100 ? '#22c55e' : '#4f46e5'}"
						></div>
					</div>
					<div class="goal-footer">
						<span class="pct">{p}%</span>
						{#if goal.deadline}
							<span class="deadline">by {goal.deadline}</span>
						{/if}
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
	.widget-fitness { max-width: 720px; }

	header { margin-bottom: 2rem; padding-bottom: 1.25rem; border-bottom: 1px solid #e5e3de; }

	.badge {
		display: inline-block;
		background: #dcfce7;
		color: #16a34a;
		font-size: 0.7rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		padding: 0.2rem 0.55rem;
		border-radius: 4px;
		margin-bottom: 0.4rem;
	}

	h1 { margin: 0 0 0.5rem; font-size: clamp(1.4rem, 3vw, 2rem); font-weight: 700; color: #1a1a2e; }
	.tags { display: flex; flex-wrap: wrap; gap: 0.4rem; margin-bottom: 0.5rem; }
	.tag { padding: 0.2rem 0.6rem; background: #dcfce7; color: #16a34a; border-radius: 99px; font-size: 0.75rem; font-weight: 600; }
	.meta { margin: 0; font-size: 0.8rem; color: #9b9baa; }

	.goals { margin-bottom: 1.75rem; }
	.goals h2 { font-size: 0.85rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #9b9baa; margin: 0 0 0.75rem; }

	.goal-card {
		background: #fafaf8;
		border: 1px solid #e5e3de;
		border-radius: 10px;
		padding: 0.85rem 1rem;
		margin-bottom: 0.65rem;
	}

	.goal-top { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 0.5rem; }
	.goal-name { font-weight: 600; color: #1a1a2e; font-size: 0.9rem; }
	.goal-value { font-size: 0.82rem; color: #6b6b80; }

	.bar-track { height: 8px; background: #e5e3de; border-radius: 99px; overflow: hidden; }
	.bar-fill { height: 100%; border-radius: 99px; transition: width 0.4s; }

	.goal-footer { display: flex; justify-content: space-between; margin-top: 0.35rem; }
	.pct { font-size: 0.78rem; font-weight: 700; color: #4f46e5; }
	.deadline { font-size: 0.78rem; color: #9b9baa; }
</style>
