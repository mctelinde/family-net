<script lang="ts">
	import type { NotebookEntry } from '$lib/types';

	interface TodoItem {
		text: string;
		done: boolean;
	}

	let { entry }: { entry: NotebookEntry } = $props();

	const data = $derived(entry.data as { items?: TodoItem[] });
	const items = $derived(data.items ?? []);
	const doneCount = $derived(items.filter((i) => i.done).length);
</script>

<article class="widget-todo">
	<header>
		<span class="badge">To-Do List</span>
		<h1>{entry.title}</h1>
		{#if entry.tags.length}
			<div class="tags">
				{#each entry.tags as tag}<span class="tag">{tag}</span>{/each}
			</div>
		{/if}
		<p class="meta">
			{doneCount} of {items.length} done · Updated {entry.updated}
		</p>
	</header>

	{#if items.length}
		<ul class="items">
			{#each items as item}
				<li class="item" class:done={item.done}>
					<span class="check" aria-hidden="true">
						{#if item.done}✓{/if}
					</span>
					<span class="text">{item.text}</span>
				</li>
			{/each}
		</ul>
	{:else}
		<p class="empty">No items yet.</p>
	{/if}

	{#if entry.body}
		<div class="body prose">{@html entry.body}</div>
	{/if}
</article>

<style>
	.widget-todo { max-width: 600px; }

	header { margin-bottom: 2rem; padding-bottom: 1.25rem; border-bottom: 1px solid #e5e3de; }

	.badge {
		display: inline-block;
		background: #fef9c3;
		color: #a16207;
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
	.tag { padding: 0.2rem 0.6rem; background: #fef9c3; color: #a16207; border-radius: 99px; font-size: 0.75rem; font-weight: 600; }
	.meta { margin: 0; font-size: 0.8rem; color: #9b9baa; }

	.items {
		list-style: none;
		margin: 0 0 1.5rem;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.item {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.7rem 1rem;
		background: #fafaf8;
		border: 1px solid #e5e3de;
		border-radius: 8px;
	}

	.item.done {
		opacity: 0.6;
	}

	.check {
		flex-shrink: 0;
		width: 1.2rem;
		height: 1.2rem;
		border: 2px solid #d1d0cb;
		border-radius: 4px;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 0.75rem;
		font-weight: 700;
		color: #fff;
		background: #d1d0cb;
	}

	.item.done .check {
		background: #22c55e;
		border-color: #22c55e;
	}

	.text {
		font-size: 0.9rem;
		color: #1a1a2e;
	}

	.item.done .text {
		text-decoration: line-through;
		color: #9b9baa;
	}

	.empty { color: #9b9baa; font-size: 0.9rem; }

	.body { margin-top: 1.5rem; padding-top: 1.25rem; border-top: 1px solid #e5e3de; }
</style>
