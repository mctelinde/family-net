<script lang="ts">
	import { Sun, Moon } from 'lucide-svelte';
	import { applyTheme, getPreferredTheme, type Theme } from '$lib/theme';

	let theme = $state<Theme>('light');

	$effect(() => {
		theme = getPreferredTheme();
	});

	function toggle() {
		theme = theme === 'dark' ? 'light' : 'dark';
		applyTheme(theme);
	}
</script>

<button
	type="button"
	class="theme-toggle"
	onclick={toggle}
	aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
	title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
>
	<span class="icon-wrap" class:spin={theme === 'dark'}>
		{#if theme === 'dark'}
			<Moon size={16} />
		{:else}
			<Sun size={16} />
		{/if}
	</span>
</button>

<style>
	.theme-toggle {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 32px;
		height: 32px;
		padding: 0;
		border: 1px solid var(--border);
		border-radius: 8px;
		background: var(--surface);
		color: var(--text-tertiary);
		cursor: pointer;
		transition: background 0.15s, color 0.15s, border-color 0.15s, transform 0.15s;
		flex-shrink: 0;
	}

	.theme-toggle:hover {
		background: var(--surface-hover);
		color: var(--text-primary);
		border-color: var(--border-strong);
	}

	.icon-wrap {
		display: flex;
		align-items: center;
		justify-content: center;
	}

	@keyframes spin-in {
		from { transform: rotate(-90deg) scale(0.6); opacity: 0; }
		to { transform: rotate(0) scale(1); opacity: 1; }
	}

	.icon-wrap.spin {
		animation: spin-in 0.25s ease;
	}
</style>
