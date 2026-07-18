<script lang="ts">
	import type { ActionData } from './$types';

	let { form }: { form: ActionData } = $props();
</script>

<svelte:head>
	<title>Sign in · Family Net</title>
</svelte:head>

<div class="page">
	<div class="card">
		<div class="logo">
			<span class="logo-mark">FN</span>
			<span class="logo-text">Family Net</span>
		</div>

		<h1>Welcome back</h1>
		<p class="subtitle">Sign in to your family notebook</p>

		{#if form?.error}
			<div class="alert" role="alert">{form.error}</div>
		{/if}

		<form method="post">
			<label>
				<span>Email</span>
				<input
					type="email"
					name="email"
					autocomplete="email"
					required
					placeholder="you@example.com"
				/>
			</label>

			<label>
				<span>Password</span>
				<input
					type="password"
					name="password"
					autocomplete="current-password"
					required
					placeholder="••••••••"
				/>
			</label>

			<button type="submit">Sign in</button>
		</form>
	</div>
</div>

<style>
	.page {
		min-height: 100dvh;
		display: grid;
		place-items: center;
		background: #f7f6f3;
		padding: 1rem;
	}

	.card {
		width: 100%;
		max-width: 380px;
		background: #fff;
		border: 1px solid #e5e3de;
		border-radius: 16px;
		padding: 2.5rem 2rem;
		box-shadow: 0 4px 24px rgba(0, 0, 0, 0.06);
	}

	.logo {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-bottom: 1.75rem;
	}

	.logo-mark {
		display: grid;
		place-items: center;
		width: 36px;
		height: 36px;
		background: #1a1a2e;
		color: #fff;
		border-radius: 8px;
		font-size: 0.8rem;
		font-weight: 700;
		letter-spacing: 0.05em;
	}

	.logo-text {
		font-weight: 600;
		font-size: 1rem;
		color: #1a1a2e;
	}

	h1 {
		margin: 0 0 0.25rem;
		font-size: 1.5rem;
		font-weight: 700;
		color: #1a1a2e;
	}

	.subtitle {
		margin: 0 0 1.5rem;
		color: #6b6b80;
		font-size: 0.9rem;
	}

	.alert {
		background: #fff1f0;
		border: 1px solid #fca5a5;
		color: #c0392b;
		border-radius: 8px;
		padding: 0.65rem 0.9rem;
		font-size: 0.875rem;
		margin-bottom: 1rem;
	}

	form {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	label {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}

	label span {
		font-size: 0.825rem;
		font-weight: 600;
		color: #3d3d4d;
	}

	input {
		padding: 0.65rem 0.85rem;
		border: 1px solid #d4d2cc;
		border-radius: 8px;
		font-size: 0.95rem;
		outline: none;
		transition: border-color 0.15s;
		color: #1a1a2e;
		background: #fafaf8;
	}

	input:focus {
		border-color: #4f46e5;
		background: #fff;
	}

	button {
		margin-top: 0.25rem;
		padding: 0.75rem;
		background: #1a1a2e;
		color: #fff;
		border: none;
		border-radius: 8px;
		font-size: 0.95rem;
		font-weight: 600;
		cursor: pointer;
		transition: background 0.15s;
	}

	button:hover {
		background: #2d2d4a;
	}
</style>
