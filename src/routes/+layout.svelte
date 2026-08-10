<script lang="ts">
	import type { LayoutData } from "./$types";
	import favicon from "$lib/assets/favicon.svg";
	import { dev } from '$app/environment';
	import { afterNavigate } from '$app/navigation';
	import { page } from '$app/state';
	import ThemeToggle from '$lib/ThemeToggle.svelte';

	let { children, data }: { children: import("svelte").Snippet; data: LayoutData } = $props();

	const user = $derived(data.user);
	const isAuth = $derived(!!user);
	const isChat = $derived(page.url.pathname === '/dev/chat');

	let navExpanded = $state(false);

	afterNavigate(() => { navExpanded = false; });
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

{#if isAuth}
	<div class="shell" class:chat-shell={isChat}>
		<nav class="sidebar">
			<div class="logo-row">
				<a href="/" class="logo">
					<span class="logo-mark">FN</span>
					<span class="logo-text">Family Net</span>
				</a>
				<ThemeToggle />
				<button
					class="nav-toggle"
					aria-label={navExpanded ? 'Collapse navigation' : 'Expand navigation'}
					aria-expanded={navExpanded}
					onclick={() => navExpanded = !navExpanded}
				>
					<span class="hamburger" class:open={navExpanded}>
						<span></span>
						<span></span>
						<span></span>
					</span>
				</button>
			</div>

			<div class="nav-collapsible" class:expanded={navExpanded}>
				<div class="sidebar-top">
					<div class="nav-section">
						<span class="nav-label">Notebook</span>
						<a href="/" class="nav-link" onclick={() => navExpanded = false}>All entries</a>
					</div>

					<div class="nav-section">
						<span class="nav-label">Agents</span>
							{#if dev || user?.role === 'admin'}
							<a href="/dev/chat" class="nav-link" onclick={() => navExpanded = false}>Chat</a>
						{/if}
					</div>

					<div class="nav-section">
						<span class="nav-label">API</span>
						<a href="/api/tools?format=openapi" target="_blank" class="nav-link ext">OpenAPI schema</a>
						<a href="/api/tools?format=openai" target="_blank" class="nav-link ext">OpenAI tools</a>
						<a href="/api/tools?format=anthropic" target="_blank" class="nav-link ext">Anthropic tools</a>
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
			</div>
		</nav>

		<main class="content" class:chat-content={isChat}>
			{@render children()}
		</main>
	</div>
{:else}
	<div class="unauth-theme-toggle">
		<ThemeToggle />
	</div>
	{@render children()}
{/if}

<style>
	:global(:root) {
		--bg: #f7f6f3;
		--sidebar-bg: #f0efe9;
		--surface: #fff;
		--surface-alt: #fafaf8;
		--surface-hover: #e5e3de;
		--border: #e5e3de;
		--border-strong: #d4d2cc;
		--text-primary: #1a1a2e;
		--text-secondary: #3d3d4d;
		--text-tertiary: #6b6b80;
		--text-muted: #9b9baa;
		--text-faint: #c4c4cf;
		--accent: #4f46e5;
		--accent-hover: #4338ca;
		--accent-soft-bg: #f0eff9;
		--accent-soft-hover: #e9e8f7;
		--danger: #c0392b;
		--danger-bg: #fff1f0;
		--danger-border: #fca5a5;
		--shadow-color: rgba(0, 0, 0, 0.06);
		--shadow-color-strong: rgba(0, 0, 0, 0.08);
		--code-bg: #1a1a2e;
		--code-text: #e2e8f0;
		color-scheme: light;
	}

	:global(:root[data-theme='dark']) {
		--bg: #14141c;
		--sidebar-bg: #191922;
		--surface: #1e1e2a;
		--surface-alt: #23232f;
		--surface-hover: #2b2b3a;
		--border: #33333f;
		--border-strong: #45454f;
		--text-primary: #f1f1f6;
		--text-secondary: #cbcbd7;
		--text-tertiary: #9d9dae;
		--text-muted: #7c7c90;
		--text-faint: #5a5a6c;
		--accent: #7c7ff0;
		--accent-hover: #9294f5;
		--accent-soft-bg: #29293f;
		--accent-soft-hover: #33334d;
		--danger: #f87171;
		--danger-bg: #3a1f1f;
		--danger-border: #6b2b2b;
		--shadow-color: rgba(0, 0, 0, 0.35);
		--shadow-color-strong: rgba(0, 0, 0, 0.5);
		--code-bg: #0d0d14;
		--code-text: #e2e8f0;
		color-scheme: dark;
	}

	:global(*, *::before, *::after) { box-sizing: border-box; }
	:global(body) { margin: 0; font-family: "Inter", system-ui, sans-serif; background: var(--bg); color: var(--text-primary); -webkit-font-smoothing: antialiased; transition: background 0.15s, color 0.15s; }
	:global(.prose h1, .prose h2, .prose h3, .prose h4) { color: var(--text-primary); line-height: 1.3; margin-top: 1.5em; margin-bottom: 0.5em; }
	:global(.prose p) { line-height: 1.7; color: var(--text-secondary); margin: 0.75em 0; }
	:global(.prose ul, .prose ol) { padding-left: 1.4em; margin: 0.75em 0; }
	:global(.prose li) { line-height: 1.6; color: var(--text-secondary); margin: 0.25em 0; }
	:global(.prose code) { background: var(--accent-soft-bg); color: var(--accent); border-radius: 4px; padding: 0.1em 0.35em; font-size: 0.875em; }
	:global(.prose pre) { background: var(--code-bg); color: var(--code-text); border-radius: 10px; padding: 1rem 1.25rem; overflow-x: auto; }
	:global(.prose a) { color: var(--accent); text-decoration: underline; text-underline-offset: 2px; }
	:global(.prose blockquote) { border-left: 3px solid var(--border); padding-left: 1rem; color: var(--text-tertiary); margin: 1em 0; font-style: italic; }
	:global(.prose strong) { font-weight: 700; color: var(--text-primary); }
	:global(.prose hr) { border: none; border-top: 1px solid var(--border); margin: 2em 0; }
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
	:global(.prose thead th) { background: var(--surface-alt); border: 1px solid var(--border); padding: 0.5rem 0.75rem; text-align: left; font-weight: 600; color: var(--text-primary); font-size: 0.82rem; }
	:global(.prose tbody td) { border: 1px solid var(--border); padding: 0.5rem 0.75rem; color: var(--text-secondary); }
	:global(.prose tbody tr:nth-child(even) td) { background: var(--surface-alt); }
	.unauth-theme-toggle { position: fixed; top: 1rem; right: 1rem; z-index: 50; }
	.shell { display: grid; grid-template-columns: 240px 1fr; min-height: 100dvh; }
	.shell.chat-shell { height: 100dvh; min-height: 0; overflow: hidden; }
	.sidebar { position: sticky; top: 0; height: 100dvh; overflow-y: auto; background: var(--sidebar-bg); border-right: 1px solid var(--border); display: flex; flex-direction: column; padding: 1.25rem 0; }
	.logo-row { display: flex; align-items: center; gap: 0.5rem; padding: 0.75rem 1rem; margin-bottom: 1rem; }
	.sidebar-top { flex: 1; padding: 0 1rem; }
	.logo { display: flex; align-items: center; gap: 0.5rem; text-decoration: none; flex: 1; }
	.logo-mark { display: grid; place-items: center; width: 32px; height: 32px; background: var(--text-primary); color: var(--bg); border-radius: 7px; font-size: 0.72rem; font-weight: 700; letter-spacing: 0.05em; }
	.logo-text { font-weight: 700; font-size: 0.95rem; color: var(--text-primary); }
	.nav-toggle { display: none; background: none; border: none; padding: 0.25rem; cursor: pointer; color: var(--text-tertiary); border-radius: 5px; line-height: 0; }
	.nav-toggle:hover { background: var(--surface-hover); color: var(--text-primary); }
	.hamburger { display: flex; flex-direction: column; justify-content: space-between; width: 18px; height: 14px; }
	.hamburger span { display: block; height: 2px; width: 100%; background: currentColor; border-radius: 2px; transition: transform 0.2s ease, opacity 0.2s ease; transform-origin: center; }
	.hamburger.open span:nth-child(1) { transform: translateY(6px) rotate(45deg); }
	.hamburger.open span:nth-child(2) { opacity: 0; transform: scaleX(0); }
	.hamburger.open span:nth-child(3) { transform: translateY(-6px) rotate(-45deg); }
	.nav-section { margin-bottom: 1.5rem; }
	.nav-label { display: block; font-size: 0.68rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: var(--text-muted); padding: 0 0.25rem; margin-bottom: 0.35rem; }
	.nav-link { display: block; padding: 0.4rem 0.6rem; border-radius: 6px; font-size: 0.85rem; color: var(--text-secondary); text-decoration: none; transition: background 0.12s; margin-bottom: 0.1rem; }
	.nav-link:hover { background: var(--surface-hover); color: var(--text-primary); }
	.nav-link.ext { font-size: 0.8rem; color: var(--text-tertiary); }
	.sidebar-bottom { padding: 0.75rem 1rem 0; border-top: 1px solid var(--border); }
	.user-info { display: flex; flex-direction: column; margin-bottom: 0.5rem; }
	.user-name { font-size: 0.85rem; font-weight: 600; color: var(--text-primary); }
	.user-role { font-size: 0.75rem; color: var(--text-muted); text-transform: capitalize; }
	.logout-btn { background: none; border: 1px solid var(--border-strong); border-radius: 6px; padding: 0.35rem 0.75rem; font-size: 0.8rem; color: var(--text-tertiary); cursor: pointer; transition: border-color 0.12s, color 0.12s; width: 100%; }
	.logout-btn:hover { border-color: var(--text-primary); color: var(--text-primary); }
	.content { padding: 2.5rem 3rem; max-width: 900px; width: 100%; }
	.content.chat-content { height: 100dvh; overflow: hidden; }
	@media (max-width: 680px) {
		.shell { grid-template-columns: 1fr; display: flex; flex-direction: column; min-height: 100dvh; }
		.shell.chat-shell { height: 100dvh; min-height: 0; }
		.sidebar { position: sticky; top: 0; height: auto; padding: 0; z-index: 100; border-right: none; border-bottom: 1px solid var(--border); }
		.logo-row { margin-bottom: 0; }
		.nav-toggle { display: flex; }
		.nav-collapsible { overflow: hidden; max-height: 0; }
		.nav-collapsible.expanded { max-height: none; padding-bottom: 0.75rem; }
		.sidebar-top { padding-top: 0; }
		.content { flex: 1; overflow-y: visible; padding: 1.5rem 1.25rem; display: flex; flex-direction: column; }
		.content.chat-content { height: auto; min-height: 0; overflow: hidden; padding-top: 0; }
	}
</style>
