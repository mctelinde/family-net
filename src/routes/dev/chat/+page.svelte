<script lang="ts">
	import { marked } from 'marked';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	const { devToolsEnabled } = data;

	// Configure marked for safe, clean output
	marked.setOptions({ breaks: true, gfm: true });

	// ── Types ────────────────────────────────────────────────────────────────

	type TextEvent  = { kind: 'text';  content: string };
	type ToolEvent  = { kind: 'tool';  name: string; args: string };
	type ErrorEvent = { kind: 'error'; message: string };
	type StreamEvent = TextEvent | ToolEvent | ErrorEvent;

	type UserTurn      = { role: 'user'; text: string };
	type AssistantTurn = { role: 'assistant'; events: StreamEvent[] };
	type Turn = UserTurn | AssistantTurn;

	type HistoryMsg = { role: string; content: string | null };

	// ── State ─────────────────────────────────────────────────────────────────

	const DEFAULT_SYSTEM_PROMPT =
		`You are a helpful assistant for the Family Net notebook app. ` +
		`When answering questions about entries, use the provided tools to look them up. ` +
		`After receiving a tool result, use the data to answer the user directly. ` +
		`Do not call the same tool more than once unless the result was an error.` +
		(devToolsEnabled
			? `\n\nDev tools are available: use run_command to run git, npm, npx, node, tsc, prettier, or eslint commands; ` +
			  `use read_file to read files; use write_file to write files; use list_dir to explore directories. ` +
			  `When the user asks you to run a command or read/write a file, call the appropriate tool directly.`
			: '');

	// Committed turns (user messages + completed assistant responses).
	let turns        = $state<Turn[]>([]);
	// Events for the in-progress assistant turn. Top-level $state so Svelte 5
	// tracks every push() directly without going through a nested object proxy.
	let streamEvents = $state<StreamEvent[]>([]);
	let history      = $state<HistoryMsg[]>([]);
	let input        = $state('');
	let busy         = $state(false);
	let showRaw      = $state(false);
	let showSystem   = $state(true);
	let systemPrompt = $state(DEFAULT_SYSTEM_PROMPT);
	let rawLog       = $state<string[]>([]);

	let threadEl = $state<HTMLElement | undefined>(undefined);

	// Derived cursor visibility
	const showThinkCursor = $derived(busy && streamEvents.length === 0);
	const showTextCursor  = $derived(busy && streamEvents.at(-1)?.kind === 'text');

	// Auto-scroll thread on new content
	$effect(() => {
		void turns; void streamEvents;
		setTimeout(() => threadEl?.scrollTo({ top: threadEl.scrollHeight, behavior: 'smooth' }), 0);
	});

	// ── Actions ───────────────────────────────────────────────────────────────

	function resetChat() {
		turns        = [];
		streamEvents = [];
		history      = [];
		rawLog       = [];
		// systemPrompt is intentionally preserved across resets
	}

	function onKey(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			void sendMessage();
		}
	}

	function prettyArgs(raw: string): string {
		try { return JSON.stringify(JSON.parse(raw), null, 2); }
		catch { return raw || '{}'; }
	}

	async function sendMessage() {
		const text = input.trim();
		if (!text || busy) return;
		input = '';

		turns.push({ role: 'user', text });
		history.push({ role: 'user', content: text });

		streamEvents = [];
		busy         = true;
		rawLog       = [];

		// Reset between tool-call iterations: each provider generator run
		// starts at index 0, so we must clear the map when a tool_calls round ends.
		let toolBuf = new Map<number, { name: string; args: string }>();
		let lastContent: string | null = null;

		try {
			const res = await fetch('/api/chat', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${data.apiKey}`,
				},
				body: JSON.stringify({
					messages: [
						...(systemPrompt.trim() ? [{ role: 'system', content: systemPrompt.trim() }] : []),
						...history,
					],
				}),
			});

			if (!res.ok || !res.body) {
				const msg = await res.text().catch(() => '');
				streamEvents.push({ kind: 'error', message: `HTTP ${res.status}${msg ? ': ' + msg : ''}` });
				return;
			}

			const reader  = res.body.getReader();
			const decoder = new TextDecoder();
			let buf = '';

			outer: while (true) {
				const { done, value } = await reader.read();
				if (done) break;
				buf += decoder.decode(value, { stream: true });

				let idx: number;
				while ((idx = buf.indexOf('\n\n')) !== -1) {
					const frame   = buf.slice(0, idx).trim();
					buf           = buf.slice(idx + 2);
					if (!frame.startsWith('data:')) continue;
					const payload = frame.slice(5).trim();
					if (payload === '[DONE]') break outer;

					rawLog.push(payload);

					type Chunk = {
						delta: {
							content?: string;
							tool_calls?: Array<{ index: number; id?: string; name?: string; arguments?: string }>;
						};
						finish_reason?: string;
						message?: { content: string | null };
						error?: { message: string };
					};

					let chunk: Chunk;
					try { chunk = JSON.parse(payload); } catch { continue; }

					if (chunk.error) {
						streamEvents.push({ kind: 'error', message: chunk.error.message });
						continue;
					}

					// Text delta — append to the last text event or create a new one
					if (typeof chunk.delta?.content === 'string' && chunk.delta.content.length > 0) {
						const last = streamEvents.at(-1);
						if (last?.kind === 'text') {
							last.content += chunk.delta.content;
						} else {
							streamEvents.push({ kind: 'text', content: chunk.delta.content });
						}
					}

					// Tool call deltas
					if (chunk.delta?.tool_calls) {
						for (const tc of chunk.delta.tool_calls) {
							const existing = toolBuf.get(tc.index);
							if (!existing) {
								const entry = { name: tc.name ?? '', args: tc.arguments ?? '' };
								toolBuf.set(tc.index, entry);
								if (tc.name) {
									streamEvents.push({ kind: 'tool', name: tc.name, args: tc.arguments ?? '' });
								}
							} else {
								if (tc.name)      existing.name  = tc.name;
								if (tc.arguments) existing.args += tc.arguments;
								for (let i = streamEvents.length - 1; i >= 0; i--) {
									const ev = streamEvents[i];
									if (ev.kind === 'tool' && ev.name === existing.name) {
										ev.args = existing.args;
										break;
									}
								}
							}
						}
					}

					if (chunk.finish_reason === 'stop' && chunk.message) {
						lastContent = chunk.message.content;
					}
					// Reset tool buffer at the end of each tool-call iteration so the
					// next iteration's index-0 tool call gets its own card.
					if (chunk.finish_reason === 'tool_calls') {
						toolBuf = new Map();
					}
					// Show a notice when the server-side iteration cap is hit.
					if (chunk.finish_reason === 'length') {
						streamEvents.push({ kind: 'error', message: 'Max tool iterations reached — the model may need a more focused prompt.' });
					}
				}
			}
		} catch (e) {
			streamEvents.push({ kind: 'error', message: String(e) });
		} finally {
			// Commit the completed turn into the turns array and clear the stream buffer.
			turns.push({ role: 'assistant', events: [...streamEvents] });
			streamEvents = [];
			busy         = false;
			if (lastContent !== null) {
				history.push({ role: 'assistant', content: lastContent });
			}
		}
	}
</script>

<svelte:head>
	<title>Chat tester · Family Net</title>
</svelte:head>

<div class="page">
	<div class="toolbar">
		<h1>Chat tester</h1>
		<div class="toolbar-actions">
			<label class="toggle">
				<input type="checkbox" bind:checked={showSystem} />
				System prompt
			</label>
			<label class="toggle">
				<input type="checkbox" bind:checked={showRaw} />
				Raw SSE
			</label>
			<button class="btn-ghost" onclick={resetChat} disabled={busy}>Clear</button>
		</div>
	</div>

	{#if showSystem}
		<div class="system-panel">
			<label class="system-label" for="sysprompt">System prompt (sent on every request)</label>
			<textarea
				id="sysprompt"
				class="system-textarea"
				bind:value={systemPrompt}
				rows="3"
				placeholder="Leave blank to send no system message."
			></textarea>
		</div>
	{/if}
	<div class="body" class:with-raw={showRaw}>
		<!-- ── Conversation thread ── -->
		<div class="thread" bind:this={threadEl}>
			{#if turns.length === 0 && !busy}
				<div class="empty">Send a message to begin. Tool calls will appear inline.</div>
			{/if}

			{#each turns as turn}
				{#if turn.role === 'user'}
					<div class="bubble user">
						<span class="bubble-text">{turn.text}</span>
					</div>
				{:else}
					<div class="bubble assistant">
						{#each turn.events as ev}
							{#if ev.kind === 'text'}
									<div class="text prose">{@html marked(ev.content)}</div>
							{:else if ev.kind === 'tool'}
								<div class="tool-card">
									<div class="tool-name">⚙ {ev.name}</div>
									<pre class="tool-args">{prettyArgs(ev.args)}</pre>
								</div>
							{:else if ev.kind === 'error'}
								<div class="error-msg">⚠ {ev.message}</div>
							{/if}
						{/each}
					</div>
				{/if}
			{/each}

			<!-- In-progress assistant turn streams here -->
			{#if busy}
				<div class="bubble assistant">
					{#if showThinkCursor}
						<span class="cursor" aria-label="Thinking"></span>
					{/if}
					{#each streamEvents as ev}
						{#if ev.kind === 'text'}
							<div class="text prose">{@html marked(ev.content)}</div>
						{:else if ev.kind === 'tool'}
							<div class="tool-card">
								<div class="tool-name">⚙ {ev.name}</div>
								<pre class="tool-args">{prettyArgs(ev.args)}</pre>
							</div>
						{:else if ev.kind === 'error'}
							<div class="error-msg">⚠ {ev.message}</div>
						{/if}
					{/each}
					{#if showTextCursor}
						<span class="cursor" style="display:block; margin-top:2px;"></span>
					{/if}
				</div>
			{/if}
		</div>

		<!-- ── Raw SSE log ── -->
		{#if showRaw}
			<div class="raw-log">
				<div class="raw-header">SSE chunks ({rawLog.length})</div>
				{#each rawLog as line}
					<pre class="raw-line">{line}</pre>
				{:else}
					<div class="raw-empty">No chunks yet.</div>
				{/each}
			</div>
		{/if}
	</div>

	<!-- ── Input bar ── -->
	<div class="input-bar">
		<textarea
			bind:value={input}
			onkeydown={onKey}
			placeholder="Message — Enter to send, Shift+Enter for newline"
			rows="2"
			disabled={busy}
		></textarea>
		<button class="btn-send" onclick={() => void sendMessage()} disabled={busy || !input.trim()}>
			{busy ? '…' : 'Send'}
		</button>
	</div>
</div>

<style>
	.page {
		display: flex;
		flex-direction: column;
		height: calc(100dvh - 5rem);
		gap: 0.75rem;
	}

	/* ── System prompt panel ── */
	.system-panel {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		flex-shrink: 0;
		background: #fff;
		border: 1px solid #e5e3de;
		border-radius: 10px;
		padding: 0.65rem 0.85rem;
	}
	.system-label { font-size: 0.75rem; font-weight: 600; color: #6b6b80; }
	.system-textarea {
		resize: vertical;
		min-height: 60px;
		border: none;
		outline: none;
		font-family: inherit;
		font-size: 0.82rem;
		color: #1a1a2e;
		line-height: 1.5;
		background: transparent;
	}

	/* ── Toolbar ── */
	.toolbar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		flex-shrink: 0;
	}
	.toolbar h1 {
		font-size: 1.1rem;
		font-weight: 700;
		color: #1a1a2e;
		margin: 0;
	}
	.toolbar-actions { display: flex; align-items: center; gap: 0.75rem; }
	.toggle {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		font-size: 0.8rem;
		color: #6b6b80;
		cursor: pointer;
		user-select: none;
	}
	.btn-ghost {
		background: none;
		border: 1px solid #d4d2cc;
		border-radius: 6px;
		padding: 0.3rem 0.7rem;
		font-size: 0.8rem;
		color: #6b6b80;
		cursor: pointer;
	}
	.btn-ghost:hover:not(:disabled) { border-color: #1a1a2e; color: #1a1a2e; }
	.btn-ghost:disabled { opacity: 0.45; cursor: default; }

	/* ── Body ── */
	.body {
		flex: 1;
		display: grid;
		grid-template-columns: 1fr;
		gap: 0.75rem;
		min-height: 0;
	}
	.body.with-raw {
		grid-template-columns: 1fr 320px;
	}

	/* ── Thread ── */
	.thread {
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
		overflow-y: auto;
		padding: 0.25rem 0.25rem 0.5rem;
		scroll-behavior: smooth;
	}
	.empty {
		margin: auto;
		color: #9b9baa;
		font-size: 0.85rem;
		text-align: center;
		padding: 2rem;
	}

	/* ── Bubbles ── */
	.bubble {
		max-width: 80%;
		padding: 0.6rem 0.9rem;
		border-radius: 12px;
		font-size: 0.88rem;
		line-height: 1.6;
		word-break: break-word;
	}
	.bubble.user {
		align-self: flex-end;
		background: #4f46e5;
		color: #fff;
		border-bottom-right-radius: 3px;
	}
	.bubble.assistant {
		align-self: flex-start;
		background: #fff;
		border: 1px solid #e5e3de;
		border-bottom-left-radius: 3px;
		color: #1a1a2e;
		max-width: 90%;
	}
	.text { display: block; }
	/* prose resets for inside bubbles */
	.text :global(p)               { margin: 0.25em 0; line-height: 1.6; }
	.text :global(p:first-child)   { margin-top: 0; }
	.text :global(p:last-child)    { margin-bottom: 0; }
	.text :global(ul), .text :global(ol) { padding-left: 1.4em; margin: 0.4em 0; }
	.text :global(li)              { margin: 0.15em 0; line-height: 1.5; }
	.text :global(code)            { background: #f0eff9; color: #4f46e5; border-radius: 4px; padding: 0.1em 0.35em; font-size: 0.82em; font-family: 'ui-monospace', monospace; }
	.text :global(pre)             { background: #1a1a2e; color: #e2e8f0; border-radius: 8px; padding: 0.75rem 1rem; overflow-x: auto; margin: 0.5em 0; }
	.text :global(pre code)        { background: none; color: inherit; padding: 0; font-size: 0.8em; }
	.text :global(strong)          { font-weight: 700; }
	.text :global(em)              { font-style: italic; }
	.text :global(h1), .text :global(h2), .text :global(h3) { font-weight: 700; margin: 0.6em 0 0.25em; line-height: 1.3; }
	.text :global(blockquote)      { border-left: 3px solid #e5e3de; padding-left: 0.75rem; color: #6b6b80; margin: 0.5em 0; font-style: italic; }
	.text :global(hr)              { border: none; border-top: 1px solid #e5e3de; margin: 0.75em 0; }

	/* Blinking CSS cursor — no Unicode character so it renders correctly in any font */
	.cursor {
		display: inline-block;
		width: 2px;
		height: 1.1em;
		background: #4f46e5;
		margin-left: 1px;
		vertical-align: text-bottom;
		border-radius: 1px;
		animation: blink 0.9s step-end infinite;
	}
	@keyframes blink { 0%, 100% { opacity: 1 } 50% { opacity: 0 } }

	/* ── Tool call card ── */
	.tool-card {
		margin: 0.4rem 0;
		border: 1px solid #e5e3de;
		border-left: 3px solid #4f46e5;
		border-radius: 6px;
		overflow: hidden;
		background: #f7f6f3;
	}
	.tool-name {
		font-size: 0.78rem;
		font-weight: 600;
		color: #4f46e5;
		padding: 0.3rem 0.6rem;
		background: #f0eff9;
		border-bottom: 1px solid #e5e3de;
	}
	.tool-args {
		margin: 0;
		padding: 0.45rem 0.6rem;
		font-size: 0.75rem;
		color: #3d3d4d;
		white-space: pre-wrap;
		word-break: break-all;
		max-height: 140px;
		overflow-y: auto;
		font-family: 'ui-monospace', 'Cascadia Code', monospace;
	}

	/* ── Error ── */
	.error-msg {
		color: #dc2626;
		font-size: 0.82rem;
		background: #fef2f2;
		border: 1px solid #fecaca;
		border-radius: 6px;
		padding: 0.4rem 0.6rem;
		margin-top: 0.25rem;
	}

	/* ── Raw SSE log ── */
	.raw-log {
		display: flex;
		flex-direction: column;
		background: #1a1a2e;
		border-radius: 10px;
		overflow-y: auto;
		padding: 0.5rem;
	}
	.raw-header {
		font-size: 0.7rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: #9b9baa;
		padding: 0.25rem 0.25rem 0.5rem;
		flex-shrink: 0;
	}
	.raw-line {
		margin: 0;
		padding: 0.15rem 0.25rem;
		font-size: 0.68rem;
		color: #a5f3fc;
		white-space: pre-wrap;
		word-break: break-all;
		font-family: 'ui-monospace', 'Cascadia Code', monospace;
		border-bottom: 1px solid #2a2a40;
	}
	.raw-empty { color: #4a4a60; font-size: 0.78rem; padding: 0.5rem; }

	/* ── Input bar ── */
	.input-bar {
		display: flex;
		gap: 0.5rem;
		align-items: flex-end;
		flex-shrink: 0;
	}
	textarea {
		flex: 1;
		resize: none;
		border: 1px solid #d4d2cc;
		border-radius: 10px;
		padding: 0.65rem 0.85rem;
		font-family: inherit;
		font-size: 0.88rem;
		color: #1a1a2e;
		background: #fff;
		line-height: 1.5;
		transition: border-color 0.12s;
	}
	textarea:focus { outline: none; border-color: #4f46e5; }
	textarea:disabled { background: #f7f6f3; color: #9b9baa; }
	.btn-send {
		background: #4f46e5;
		color: #fff;
		border: none;
		border-radius: 10px;
		padding: 0 1.25rem;
		height: 52px;
		font-size: 0.88rem;
		font-weight: 600;
		cursor: pointer;
		transition: background 0.12s;
		flex-shrink: 0;
	}
	.btn-send:hover:not(:disabled) { background: #4338ca; }
	.btn-send:disabled { background: #c7d2fe; cursor: default; }
</style>
