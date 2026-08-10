<script lang="ts">
	import type { PageData } from './$types';
	import { getWidget } from '$lib/widgets';

	let { data }: { data: PageData } = $props();
	let Widget = $derived(getWidget(data.entry.type));
</script>

<svelte:head>
	<title>{data.entry.title} · Family Net</title>
</svelte:head>

<div class="page">
	<div class="breadcrumb">
		<a href="/">Notebook</a>
		<span>›</span>
		<span>{data.entry.title}</span>
	</div>

	<Widget entry={data.entry} />
</div>

<style>
	.breadcrumb {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.8rem;
		color: var(--text-muted);
		margin-bottom: 1.75rem;
	}

	.breadcrumb a {
		color: var(--text-tertiary);
		text-decoration: none;
		transition: color 0.12s;
	}

	.breadcrumb a:hover { color: var(--text-primary); }
</style>
