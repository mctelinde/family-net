<script lang="ts">
	import type { LayoutData } from "./$types";
	import favicon from "$lib/assets/favicon.svg";
	import { dev } from '$app/environment';

	let { children, data }: { children: import("svelte").Snippet; data: LayoutData } = $props();

	const user = $derived(data.user);
	const isAuth = $derived(!!user);
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

{#if isAuth}
	<div class="shell">
		<nav class="sidebar">
			<div class="sidebar-top">
				<a href="/" class="logo">
					<span class="logo-mark">FN</span>
					<span class="logo-text">Family Net</span>
				</a>

				<div class="nav-section">
					<span class="nav-label">Notebook</span>
					<a href="/" class="nav-link">All entries</a>
				</div>

				<div class="nav-section">
					<span class="nav-label">API and Agents</span>
					<a href="/api/tools?format=openapi" target="_blank" class="nav-link ext">OpenAPI schema</a>
					<a href="/api/tools?format=openai" target="_blank" class="nav-link ext">OpenAI tools</a>
					<a href="/api/tools?format=anthropic" target="_blank" class="nav-link ext">Anthropic tools</a>
					{#if dev}
						<a href="/dev/chat" class="nav-link">Chat tester</a>
					{/if}
				</div>
			</div>

			<div class="sidebar-bottom">
				<div class="user-info">
					<span class="user-name">{user?.name}</span>
					<span class="user-role">{user?.role}</span>
				</div>
				<form method="post" action="/logout">
					<button type="submit" class="logout-btn">Sign out</button>
				</form>
			</div>
		</nav>

		<main class="content">
			{@render children()}
		</main>
	</div>
{:else}
	{@render children()}
{/if}

<style>
	:global(*, *::before, *::after) { box-sizing: border-box; }
	:global(body) { margin: 0; font-family: "Inter", system-ui, sans-serif; background: #f7f6f3; color: #1a1a2e; -webkit-font-smoothing: antialiased; }
	:global(.prose h1, .prose h2, .prose h3, .prose h4) { color: #1a1a2e; line-height: 1.3; margin-top: 1.5em; margin-bottom: 0.5em; }
	:global(.prose p) { line-height: 1.7; color: #3d3d4d; margin: 0.75em 0; }
	:global(.prose ul, .prose ol) { padding-left: 1.4em; margin: 0.75em 0; }
	:global(.prose li) { line-height: 1.6; color: #3d3d4d; margin: 0.25em 0; }
	:global(.prose code) { background: #f0eff9; color: #4f46e5; border-radius: 4px; padding: 0.1em 0.35em; font-size: 0.875em; }
	:global(.prose pre) { background: #1a1a2e; color: #e2e8f0; border-radius: 10px; padding: 1rem 1.25rem; overflow-x: auto; }
	:global(.prose a) { color: #4f46e5; text-decoration: underline; text-underline-offset: 2px; }
	:global(.prose blockquote) { border-left: 3px solid #e5e3de; padding-left: 1rem; color: #6b6b80; margin: 1em 0; font-style: italic; }
	:global(.prose strong) { font-weight: 700; color: #1a1a2e; }
	:global(.prose hr) { border: none; border-top: 1px solid #e5e3de; margin: 2em 0; }
	:global(.prose table) {
		min-width: 0;
		border-collapse: collapse;
		margin: 0.75rem 0;
		font-size: 0.875rem;
		overflow-x: auto;
		-webkit-overflow-scrolling: touch;
	}
	:global(.prose thead th),
	:global(.prose tbody td) {
		overflow-wrap: anywhere;
		word-break: normal;
	}
	:global(.prose img) {
		max-width: 100%;
		height: auto;
	}
	:global(.prose thead th) { background: #f4f4f5; border: 1px solid #e5e3de; padding: 0.5rem 0.75rem; text-align: left; font-weight: 600; color: #1a1a2e; font-size: 0.82rem; }
	:global(.prose tbody td) { border: 1px solid #e5e3de; padding: 0.5rem 0.75rem; color: #3d3d4d; }
	:global(.prose tbody tr:nth-child(even) td) { background: #fafaf8; }
	.shell { display: grid; grid-template-columns: 240px 1fr; min-height: 100dvh; }
	.sidebar { position: sticky; top: 0; height: 100dvh; overflow-y: auto; background: #f0efe9; border-right: 1px solid #e5e3de; display: flex; flex-direction: column; padding: 1.25rem 0; }
	.sidebar-top { flex: 1; padding: 0 1rem; }
	.logo { display: flex; align-items: center; gap: 0.5rem; text-decoration: none; margin-bottom: 1.75rem; }
	.logo-mark { display: grid; place-items: center; width: 32px; height: 32px; background: #1a1a2e; color: #fff; border-radius: 7px; font-size: 0.72rem; font-weight: 700; letter-spacing: 0.05em; }
	.logo-text { font-weight: 700; font-size: 0.95rem; color: #1a1a2e; }
	.nav-section { margin-bottom: 1.5rem; }
	.nav-label { display: block; font-size: 0.68rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #9b9baa; padding: 0 0.25rem; margin-bottom: 0.35rem; }
	.nav-link { display: block; padding: 0.4rem 0.6rem; border-radius: 6px; font-size: 0.85rem; color: #3d3d4d; text-decoration: none; transition: background 0.12s; margin-bottom: 0.1rem; }
	.nav-link:hover { background: #e5e3de; color: #1a1a2e; }
	.nav-link.ext { font-size: 0.8rem; color: #6b6b80; }
	.sidebar-bottom { padding: 0.75rem 1rem 0; border-top: 1px solid #e5e3de; }
	.user-info { display: flex; flex-direction: column; margin-bottom: 0.5rem; }
	.user-name { font-size: 0.85rem; font-weight: 600; color: #1a1a2e; }
	.user-role { font-size: 0.75rem; color: #9b9baa; text-transform: capitalize; }
	.logout-btn { background: none; border: 1px solid #d4d2cc; border-radius: 6px; padding: 0.35rem 0.75rem; font-size: 0.8rem; color: #6b6b80; cursor: pointer; transition: border-color 0.12s, color 0.12s; width: 100%; }
	.logout-btn:hover { border-color: #1a1a2e; color: #1a1a2e; }
	.content { padding: 2.5rem 3rem; max-width: 900px; width: 100%; }
	@media (max-width: 680px) {
		.shell { grid-template-columns: 1fr; }
		.sidebar { position: static; height: auto; }
		.content { padding: 1.5rem 1.25rem; }
	}
</style>
