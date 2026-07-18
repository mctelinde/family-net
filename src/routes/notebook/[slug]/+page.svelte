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
	.page { width: 100%; }

	.breadcrumb {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.8rem;
		color: #9b9baa;
		margin-bottom: 1.75rem;
	}

	.breadcrumb a {
		color: #6b6b80;
		text-decoration: none;
		transition: color 0.12s;
	}

	.breadcrumb a:hover { color: #1a1a2e; }
</style>
