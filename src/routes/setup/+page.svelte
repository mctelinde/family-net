<script lang="ts">
	import type { ActionData } from './$types';

	let { form }: { form: ActionData } = $props();
</script>

<svelte:head>
	<title>Setup · TeliNet</title>
</svelte:head>

<div class="page">
	<div class="card">
		<div class="logo">
			<span class="logo-mark">TN</span>
			<span class="logo-text">TeliNet</span>
		</div>

		<h1>Create your account</h1>
		<p class="subtitle">First-run setup — you'll be the admin.</p>

		{#if form?.error}
			<div class="alert" role="alert">{form.error}</div>
		{/if}

		<form method="post">
			<label>
				<span>Your name</span>
				<input type="text" name="name" required placeholder="Jane Smith" />
			</label>
			<label>
				<span>Email</span>
				<input type="email" name="email" autocomplete="email" required placeholder="you@example.com" />
			</label>
			<label>
				<span>Password</span>
				<input type="password" name="password" autocomplete="new-password" required placeholder="Min. 8 characters" />
			</label>
			<label>
				<span>Confirm password</span>
				<input type="password" name="confirm" autocomplete="new-password" required placeholder="••••••••" />
			</label>
			<button type="submit">Create account &amp; continue</button>
		</form>
	</div>
</div>

<style>
	.page {
		min-height: 100dvh;
		display: grid;
		place-items: center;
		background: var(--bg);
		padding: 1rem;
	}
	.card {
		width: 100%;
		max-width: 380px;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 16px;
		padding: 2.5rem 2rem;
		box-shadow: 0 4px 24px var(--shadow-color);
	}
	.logo { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 1.75rem; }
	.logo-mark {
		display: grid; place-items: center;
		width: 36px; height: 36px;
		background: var(--text-primary); color: var(--bg);
		border-radius: 8px; font-size: 0.8rem; font-weight: 700; letter-spacing: 0.05em;
	}
	.logo-text { font-family: 'Fraunces', Georgia, serif; font-weight: 600; font-size: 1.1rem; letter-spacing: 0.01em; color: var(--text-primary); }
	h1 { margin: 0 0 0.25rem; font-size: 1.5rem; font-weight: 700; color: var(--text-primary); }
	.subtitle { margin: 0 0 1.5rem; color: var(--text-tertiary); font-size: 0.9rem; }
	.alert { background: var(--danger-bg); border: 1px solid var(--danger-border); color: var(--danger); border-radius: 8px; padding: 0.65rem 0.9rem; font-size: 0.875rem; margin-bottom: 1rem; }
	form { display: flex; flex-direction: column; gap: 1rem; }
	label { display: flex; flex-direction: column; gap: 0.35rem; }
	label span { font-size: 0.825rem; font-weight: 600; color: var(--text-secondary); }
	input { padding: 0.65rem 0.85rem; border: 1px solid var(--border-strong); border-radius: 8px; font-size: 0.95rem; outline: none; transition: border-color 0.15s; color: var(--text-primary); background: var(--surface-alt); }
	input:focus { border-color: var(--accent); background: var(--surface); }
	button { margin-top: 0.25rem; padding: 0.75rem; background: var(--text-primary); color: var(--bg); border: none; border-radius: 8px; font-size: 0.95rem; font-weight: 600; cursor: pointer; transition: background 0.15s; }
	button:hover { background: var(--accent); color: #fff; }
</style>
