<script lang="ts">
	import type { NotebookEntry } from '$lib/types';

	let { entry }: { entry: NotebookEntry } = $props();
</script>

<article class="widget-note">
	<header>
		<h1>{entry.title}</h1>
		{#if entry.tags.length}
			<div class="tags">
				{#each entry.tags as tag}
					<span class="tag">{tag}</span>
				{/each}
			</div>
		{/if}
		<p class="meta">Updated {entry.updated}</p>
	</header>

	<div class="body prose">{@html entry.body}</div>
</article>

<style>
	.widget-note {
		max-width: 720px;
	}

	header {
		margin-bottom: 2rem;
		padding-bottom: 1.25rem;
		border-bottom: 1px solid #e5e3de;
	}

	h1 {
		margin: 0 0 0.5rem;
		font-size: clamp(1.4rem, 3vw, 2rem);
		font-weight: 700;
		color: #1a1a2e;
		line-height: 1.25;
	}

	.tags {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
		margin-bottom: 0.5rem;
	}

	.tag {
		padding: 0.2rem 0.6rem;
		background: #f0eff9;
		color: #4f46e5;
		border-radius: 99px;
		font-size: 0.75rem;
		font-weight: 600;
	}

	.meta {
		margin: 0;
		font-size: 0.8rem;
		color: #9b9baa;
	}
</style>
