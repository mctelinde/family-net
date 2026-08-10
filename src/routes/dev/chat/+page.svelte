<script lang="ts">
	import { marked } from 'marked';
	import { tick } from 'svelte';
	import type { PageData } from './$types';
	import { Settings, SquarePen, Clock } from 'lucide-svelte';

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

	type SavedConversation = {
		id: string;
		title: string;
		savedAt: string;
		turns: Turn[];
		history: HistoryMsg[];
		systemPrompt: string;
	};

	// ── State ─────────────────────────────────────────────────────────────────

	const STORAGE_KEY = 'chat-tester-history';

	const DEFAULT_SYSTEM_PROMPT =
		`You are a helpful assistant for the Family Net notebook app. ` +
		`When answering questions about entries, use the provided tools to look them up. ` +
		`After receiving a tool result, use the data to answer the user directly. ` +
		`Do not call the same tool more than once unless the result was an error.\n\n` +

		`## Important rules\n` +
		`- NEVER print tool call JSON, raw arguments, or internal reasoning in your response. ` +
		`Call tools silently; only speak to the user in plain language before and after.\n` +
		`- Do not repeat a failed tool call with the same arguments.\n` +
		`- Do not apologize repeatedly. If a tool call fails once, try a different approach or tell the user.\n\n` +

		`## Updating or adding to a notebook entry\n` +
		`Use this workflow whenever the user asks to add, remove, or change content inside an entry:\n` +
		`Step 1: Call list_entries to find the correct slug (do NOT guess a slug).\n` +
		`Step 2: Call read_entry with that slug to get the current body. NEVER invent or assume content.\n` +
		`Step 3: Apply only the requested change to the body you just read.\n` +
		`Step 4: Call write_entry with the same slug, title, and type — and the fully updated body.\n` +
		`- If list_entries returns no matching entry, tell the user the entry was not found and ask whether to create it. Do NOT create it automatically with invented content.\n` +

		(devToolsEnabled
			? `\n## Modifying source code\n` +
			  `Use this workflow ONLY when the user asks to change application code or files — NOT for notebook entries:\n` +
			  `Step 1: Call read_file on ARCHITECTURE.md\n` +
			  `Step 2: Call read_file on the source file that needs to change\n` +
			  `Step 3: Check whether the requested change is already present in the file.\n` +
			  `  - If the change is already done, tell the user and STOP. Do not call any more tools.\n` +
			  `  - If the change is NOT done, call patch_file to apply it.\n\n` +
			  `Rules:\n` +
			  `- NEVER write to ARCHITECTURE.md\n` +
			  `- Do not describe or show code — just execute the steps\n` +
			  `- Do not repeat a failed tool call with the same arguments\n` +
			  `- Prefer patch_file find-replace mode (old/new) over line_number mode\n\n` +
			  `Dev tools: read_file, write_file, patch_file, run_command, search_files, list_dir`
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
	let showSystem   = $state(false);
	let systemPrompt = $state(DEFAULT_SYSTEM_PROMPT);
	let rawLog       = $state<string[]>([]);
	let showHistory  = $state(false);
	let expandedTools = $state(new Set<string>());
	let savedConversations = $state<SavedConversation[]>([]);
	// Track the ID of the conversation currently loaded, so saves update in place.
	let activeConversationId = $state<string | null>(null);
	// Track whether we've auto-loaded to prevent re-loading on every effect run
	let hasAutoLoadedOnMount = $state(false);

	let threadEl = $state<HTMLElement | undefined>(undefined);
	let inputEl = $state<HTMLTextAreaElement | undefined>(undefined);

	async function scrollThreadToBottom(behavior: ScrollBehavior = 'auto') {
		await tick();
		threadEl?.scrollTo({ top: threadEl.scrollHeight, behavior });
	}

	async function focusInput() {
		await tick();
		inputEl?.focus({ preventScroll: true });
	}

	// Derived cursor visibility
	const showThinkCursor = $derived(busy && streamEvents.length === 0);
	const showTextCursor  = $derived(busy && streamEvents.at(-1)?.kind === 'text');

	// Load saved conversations from localStorage on mount
	$effect(() => {
		try {
			const raw = localStorage.getItem(STORAGE_KEY);
			const loaded = raw ? (JSON.parse(raw) as SavedConversation[]) : [];
			savedConversations = loaded;
			// Auto-load the latest conversation only once on initial page load
			if (!hasAutoLoadedOnMount && loaded.length > 0 && turns.length === 0) {
				hasAutoLoadedOnMount = true;
				const latest = loaded[0];
				loadConversation(latest.id);
			}
		} catch {
			savedConversations = [];
		}
	});

	// ── Persistence helpers ────────────────────────────────────────────────────

	function saveCurrentConversation() {
		const firstUserTurn = turns.find((t): t is UserTurn => t.role === 'user');
		const title = firstUserTurn
			? firstUserTurn.text.slice(0, 60) + (firstUserTurn.text.length > 60 ? '…' : '')
			: 'Untitled conversation';

		const now = new Date().toISOString();
		const existing = activeConversationId
			? savedConversations.findIndex(c => c.id === activeConversationId)
			: -1;

		const saved: SavedConversation = {
			id: activeConversationId ?? crypto.randomUUID(),
			title,
			savedAt: now,
			turns: JSON.parse(JSON.stringify(turns)) as Turn[],
			history: JSON.parse(JSON.stringify(history)) as HistoryMsg[],
			systemPrompt,
		};

		if (existing >= 0) {
			savedConversations[existing] = saved;
		} else {
			activeConversationId = saved.id;
			savedConversations.unshift(saved);
		}

		try {
			localStorage.setItem(STORAGE_KEY, JSON.stringify(savedConversations));
		} catch {
			// localStorage quota exceeded — silently skip
		}
	}

	function loadConversation(id: string) {
		const conv = savedConversations.find(c => c.id === id);
		if (!conv) return;
		turns                = JSON.parse(JSON.stringify(conv.turns)) as Turn[];
		history              = JSON.parse(JSON.stringify(conv.history)) as HistoryMsg[];
		systemPrompt         = conv.systemPrompt;
		streamEvents.length  = 0;
		rawLog.length        = 0;
		busy                 = false;
		activeConversationId = conv.id;
		showHistory          = false;
		void scrollThreadToBottom();
	}

	function deleteConversation(id: string) {
		const idx = savedConversations.findIndex(c => c.id === id);
		if (idx >= 0) savedConversations.splice(idx, 1);
		if (activeConversationId === id) activeConversationId = null;
		try {
			localStorage.setItem(STORAGE_KEY, JSON.stringify(savedConversations));
		} catch { /* empty */ }
	}

	function formatDate(iso: string): string {
		const d = new Date(iso);
		const now = new Date();
		const diffMs = now.getTime() - d.getTime();
		const diffMins = Math.floor(diffMs / 60_000);
		if (diffMins < 1)   return 'just now';
		if (diffMins < 60)  return `${diffMins}m ago`;
		const diffHrs = Math.floor(diffMins / 60);
		if (diffHrs < 24)   return `${diffHrs}h ago`;
		const diffDays = Math.floor(diffHrs / 24);
		if (diffDays < 7)   return `${diffDays}d ago`;
		return d.toLocaleDateString();
	}

	// ── Actions ───────────────────────────────────────────────────────────────

	function resetChat() {
		turns.length                = 0;
		streamEvents.length         = 0;
		history.length              = 0;
		rawLog.length               = 0;
		activeConversationId        = null;
		systemPrompt                = DEFAULT_SYSTEM_PROMPT;
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

	/** Returns a short inline summary of the most relevant tool argument. */
	function toolSummary(args: string): string {
		try {
			const obj = JSON.parse(args) as Record<string, unknown>;
			const priority = ['path', 'file_path', 'filename', 'command', 'pattern', 'query'];
			for (const key of priority) {
				if (typeof obj[key] === 'string') return obj[key] as string;
			}
			// Fall back to the first string value
			for (const val of Object.values(obj)) {
				if (typeof val === 'string') return val;
			}
		} catch { /* empty */ }
		return '';
	}

	function toggleTool(key: string) {
		const next = new Set(expandedTools);
		if (next.has(key)) next.delete(key); else next.add(key);
		expandedTools = next;
	}

	function eventsToMarkdown(events: StreamEvent[]): string {
		let md = '';
		for (const ev of events) {
			if (ev.kind === 'text') {
				md += ev.content + '\n\n';
			} else if (ev.kind === 'tool') {
				md += `**Tool: ${ev.name}**\n\`\`\`json\n${prettyArgs(ev.args)}\n\`\`\`\n\n`;
			} else if (ev.kind === 'error') {
				md += `⚠️ **Error:** ${ev.message}\n\n`;
			}
		}
		return md.trim();
	}

	async function copyResponseToClipboard(events: StreamEvent[]) {
		const markdown = eventsToMarkdown(events);
		try {
			await navigator.clipboard.writeText(markdown);
			// Show brief success feedback
			const tempMsg = 'Copied to clipboard!';
			// You could show a toast here if available
		} catch (err) {
			console.error('Failed to copy:', err);
		}
	}

	async function sendMessage() {
		const text = input.trim();
		if (!text || busy) return;
		input = '';

		turns.push({ role: 'user', text });
		history.push({ role: 'user', content: text });

		streamEvents.length = 0;
		busy                = true;
		rawLog.length       = 0;
		await focusInput();
		await scrollThreadToBottom();

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
						await scrollThreadToBottom();
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
						await scrollThreadToBottom();
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
									await scrollThreadToBottom();
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
						await scrollThreadToBottom();
					}
				}
			}
		} catch (e) {
			streamEvents.push({ kind: 'error', message: String(e) });
		} finally {
			// Commit the completed turn into the turns array and clear the stream buffer.
			turns.push({ role: 'assistant', events: [...streamEvents] });
			streamEvents.length = 0;
			busy                = false;
			if (lastContent !== null) {
				history.push({ role: 'assistant', content: lastContent });
			}
			await scrollThreadToBottom('smooth');
			await focusInput();
			// Save the conversation after message completes
			saveCurrentConversation();
		}
	}
</script>

<svelte:head>
	<title>Chat · Family Net</title>
</svelte:head>

<div class="page">
	<div class="toolbar">
		<h1>Chat</h1>
		<div class="toolbar-actions">
			<div class="toggle-group">
				<input 
					type="checkbox" 
					id="raw-sse-toggle"
					bind:checked={showRaw}
					class="circular-toggle"
				/>
				<label for="raw-sse-toggle" class="toggle-label">Raw SSE</label>
			</div>
			<button
				class="btn-ghost"
				class:active={showHistory}
				onclick={() => (showHistory = !showHistory)}
				title="Browse past conversations"
				aria-label="Browse past conversations"
			>
				<Clock size={16} aria-hidden="true" />{#if savedConversations.length > 0}<span class="badge">{savedConversations.length}</span>{/if}
			</button>
			<button
				class="btn-ghost"
				onclick={() => (showSystem = true)}
				title="Edit system prompt"
				aria-label="Edit system prompt"
			>
				<Settings size={16} aria-hidden="true" />
			</button>
			<button class="btn-ghost" onclick={resetChat} disabled={busy} title="New chat" aria-label="New chat">
				<SquarePen size={16} aria-hidden="true" />
			</button>
		</div>
	</div>

	{#if showHistory}
		<div class="history-panel">
			<div class="history-header">
				<span>Saved conversations</span>
				{#if savedConversations.length > 0}
					<button
						class="btn-ghost btn-xs"
						onclick={() => {
							if (confirm('Delete all saved conversations?')) {
								savedConversations = [];
								activeConversationId = null;
								localStorage.removeItem(STORAGE_KEY);
							}
						}}
					>Clear all</button>
				{/if}
			</div>
			{#if savedConversations.length === 0}
				<div class="history-empty">No saved conversations yet. Start chatting and they'll appear here.</div>
			{:else}
				<ul class="history-list">
					{#each savedConversations as conv (conv.id)}
						<li
							class="history-item"
							class:history-item-active={conv.id === activeConversationId}
						>
							<button class="history-load" onclick={() => loadConversation(conv.id)}>
								<span class="history-title">{conv.title}</span>
								<span class="history-meta">{formatDate(conv.savedAt)} · {conv.turns.filter(t => t.role === 'user').length} messages</span>
							</button>
							<button
								class="history-delete"
								onclick={() => deleteConversation(conv.id)}
								title="Delete conversation"
								aria-label="Delete conversation"
							>✕</button>
						</li>
					{/each}
				</ul>
			{/if}
		</div>
	{/if}

	{#if showSystem}
		<div class="modal-overlay" onclick={() => (showSystem = false)}>
			<div class="modal" onclick={(e) => e.stopPropagation()}>
				<div class="modal-header">
					<h2>System Prompt</h2>
					<button class="modal-close" onclick={() => (showSystem = false)}>✕</button>
				</div>
				<label class="modal-label" for="sysprompt">Edit or clear to change:</label>
				<textarea
					id="sysprompt"
					class="modal-textarea"
					bind:value={systemPrompt}
					rows="10"
					placeholder="Leave blank to send no system message."
				></textarea>
				<div class="modal-footer">
					<button class="btn-primary" onclick={() => (showSystem = false)}>Done</button>
				</div>
			</div>
		</div>
	{/if}
	<div class="body" class:with-raw={showRaw}>
		<!-- ── Conversation thread ── -->
		<div class="thread" bind:this={threadEl}>
			{#if turns.length === 0 && !busy}
					<div class="empty">Send a message to begin. Tool calls will appear inline.<br>Past conversations are saved automatically — use the History button to return to them.</div>
			{/if}

			{#each turns as turn, ti}
				{#if turn.role === 'user'}
					<div class="bubble user">
						<div class="user-prose">{@html marked(turn.text)}</div>
					</div>
				{:else}
					<div class="bubble assistant">
						<button 
							class="copy-btn" 
							title="Copy response as markdown"
							onclick={() => copyResponseToClipboard(turn.events)}
						>📋 Copy</button>
						{#each turn.events as ev, ei}
							{#if ev.kind === 'text'}
									<div class="text prose">{@html marked(ev.content)}</div>
							{:else if ev.kind === 'tool'}
								{@const key = `t${ti}e${ei}`}
								<div class="tool-card">
									<button class="tool-header" onclick={() => toggleTool(key)}>
										<span class="tool-icon">⚙</span>
										<span class="tool-label">{ev.name}{#if toolSummary(ev.args)}<span class="tool-summary">: {toolSummary(ev.args)}</span>{/if}</span>
										<span class="tool-chevron">{expandedTools.has(key) ? '▾' : '▸'}</span>
									</button>
									{#if expandedTools.has(key)}
										<pre class="tool-args">{prettyArgs(ev.args)}</pre>
									{/if}
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
					{#each streamEvents as ev, ei}
						{#if ev.kind === 'text'}
							<div class="text prose">{@html marked(ev.content)}</div>
						{:else if ev.kind === 'tool'}
							{@const key = `stream-${ei}`}
							<div class="tool-card">
								<button class="tool-header" onclick={() => toggleTool(key)}>
									<span class="tool-icon">⚙</span>
									<span class="tool-label">{ev.name}{#if toolSummary(ev.args)}<span class="tool-summary">: {toolSummary(ev.args)}</span>{/if}</span>
									<span class="tool-chevron">{expandedTools.has(key) ? '▾' : '▸'}</span>
								</button>
								{#if expandedTools.has(key)}
									<pre class="tool-args">{prettyArgs(ev.args)}</pre>
								{/if}
							</div>
						{:else if ev.kind === 'error'}
							<div class="error-msg">⚠ {ev.message}</div>
						{/if}
					{/each}
					{#if showTextCursor}
						<span class="cursor" style="display:block; margin-top:2px;"></span>
					{/if}
				</div>
				{:else if streamEvents.length > 0}
					<div class="bubble assistant">
						<button 
							class="copy-btn" 
							title="Copy response as markdown"
							onclick={() => copyResponseToClipboard(streamEvents)}
						>📋 Copy</button>
						{#each streamEvents as ev, ei}
							{#if ev.kind === 'text'}
								<div class="text prose">{@html marked(ev.content)}</div>
							{:else if ev.kind === 'tool'}
								{@const key = `overflow-${ei}`}
								<div class="tool-card">
									<button class="tool-header" onclick={() => toggleTool(key)}>
										<span class="tool-icon">⚙</span>
										<span class="tool-label">{ev.name}{#if toolSummary(ev.args)}<span class="tool-summary">: {toolSummary(ev.args)}</span>{/if}</span>
										<span class="tool-chevron">{expandedTools.has(key) ? '▾' : '▸'}</span>
									</button>
									{#if expandedTools.has(key)}
										<pre class="tool-args">{prettyArgs(ev.args)}</pre>
									{/if}
								</div>
							{:else if ev.kind === 'error'}
								<div class="error-msg">⚠ {ev.message}</div>
							{/if}
						{/each}
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
			bind:this={inputEl}
			bind:value={input}
			onkeydown={onKey}
			placeholder="Message — Enter to send, Shift+Enter for newline"
			rows="2"
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
		height: 100%;
		min-height: 0;
		overflow: hidden;
		gap: 0.75rem;
	}
	@media (max-width: 680px) {
		.page { 
			flex: 1;
			display: flex;
			flex-direction: column;
			gap: 0; 
			padding: 0; 
			box-sizing: border-box;
			overflow: hidden;
		}
		.toolbar { 
			flex-shrink: 0; 
			min-height: 3rem;
		}
		.history-panel {
			flex-shrink: 0;
			max-height: 150px;
		}
		.body { 
			flex: 1; 
			display: flex; 
			flex-direction: column; 
			overflow: hidden; 
			min-height: 0; 
		}
		.body.with-raw { 
			grid-template-columns: unset; 
		}
		.thread { 
			flex: 1; 
			overflow-y: auto; 
			max-height: none; 
			padding: 0.25rem 0.25rem 0.5rem; 
		}
		.empty {
			margin: 0;
			padding: 0.5rem;
		}
		.input-bar { 
			flex-shrink: 0;
		}
	}

	/* ── Modal ── */
	.modal-overlay {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.5);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 999;
	}
	.modal {
		background: var(--surface);
		border-radius: 12px;
		box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.15);
		width: 90%;
		max-width: 600px;
		max-height: 80vh;
		display: flex;
		flex-direction: column;
	}
	.modal-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 1rem 1.25rem;
		border-bottom: 1px solid var(--border);
		flex-shrink: 0;
	}
	.modal-header h2 {
		margin: 0;
		font-size: 1rem;
		color: var(--text-primary);
	}
	.modal-close {
		background: none;
		border: none;
		font-size: 1.2rem;
		color: var(--text-tertiary);
		cursor: pointer;
		padding: 0;
		width: 24px;
		height: 24px;
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.modal-close:hover { color: var(--text-primary); }
	.modal-label {
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--text-tertiary);
		padding: 0 1.25rem;
		padding-top: 1rem;
		display: block;
	}
	.modal-textarea {
		flex: 1;
		margin: 0.5rem 1.25rem;
		resize: none;
		border: 1px solid var(--border);
		border-radius: 8px;
		padding: 0.75rem;
		font-family: inherit;
		font-size: 1rem;
		color: var(--text-primary);
		line-height: 1.5;
		background: transparent;
		outline: none;
	}
	.modal-textarea:focus { border-color: var(--accent); }
	.modal-footer {
		display: flex;
		justify-content: flex-end;
		padding: 1rem 1.25rem;
		border-top: 1px solid var(--border);
		flex-shrink: 0;
	}
	.btn-primary {
		background: var(--accent);
		color: #fff;
		border: none;
		border-radius: 8px;
		padding: 0.5rem 1rem;
		font-size: 0.88rem;
		font-weight: 600;
		cursor: pointer;
		transition: background 0.12s;
	}
	.btn-primary:hover { background: var(--accent-hover); }

	/* ── Circular toggle switch ── */
	.toggle-group {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}
	.toggle-label {
		font-size: 0.8rem;
		color: var(--text-tertiary);
		cursor: pointer;
		user-select: none;
	}
	.circular-toggle {
		appearance: none;
		width: 40px;
		height: 24px;
		background: var(--border-strong);
		border: none;
		border-radius: 12px;
		cursor: pointer;
		position: relative;
		transition: background 0.3s;
		padding: 0;
	}
	.circular-toggle::before {
		content: '';
		position: absolute;
		width: 20px;
		height: 20px;
		background: var(--surface);
		border-radius: 50%;
		top: 2px;
		left: 2px;
		transition: left 0.3s;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
	}
	.circular-toggle:checked {
		background: var(--accent);
	}
	.circular-toggle:checked::before {
		left: 18px;
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
		color: var(--text-primary);
		margin: 0;
	}
	.toolbar-actions { display: flex; align-items: center; gap: 0.75rem; }
	.toggle {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		font-size: 0.8rem;
		color: var(--text-tertiary);
		cursor: pointer;
		user-select: none;
	}
	.btn-ghost {
		background: none;
		border: 1px solid var(--border-strong);
		border-radius: 6px;
		padding: 0.3rem 0.7rem;
		font-size: 0.8rem;
		color: var(--text-tertiary);
		cursor: pointer;
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
	}
	.btn-ghost:hover:not(:disabled) { border-color: var(--text-primary); color: var(--text-primary); }
	.btn-ghost:disabled { opacity: 0.45; cursor: default; }
	.btn-ghost.active { border-color: var(--accent); color: var(--accent); background: var(--accent-soft-bg); }
	.btn-xs { padding: 0.15rem 0.45rem; font-size: 0.72rem; }

	.badge {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		background: var(--accent);
		color: #fff;
		border-radius: 10px;
		font-size: 0.65rem;
		font-weight: 700;
		min-width: 1.2em;
		padding: 0 0.25em;
		line-height: 1.5;
	}

	/* ── History panel ── */
	.history-panel {
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 10px;
		flex-shrink: 0;
		max-height: 220px;
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}
	.history-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.5rem 0.75rem;
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--text-tertiary);
		border-bottom: 1px solid var(--border);
		flex-shrink: 0;
	}
	.history-empty {
		padding: 0.75rem;
		font-size: 0.8rem;
		color: var(--text-muted);
		text-align: center;
	}
	.history-list {
		list-style: none;
		margin: 0;
		padding: 0;
		overflow-y: auto;
	}
	.history-item {
		display: flex;
		align-items: center;
		border-bottom: 1px solid var(--border);
	}
	.history-item:last-child { border-bottom: none; }
	.history-item-active { background: var(--accent-soft-bg); }
	.history-load {
		flex: 1;
		background: none;
		border: none;
		text-align: left;
		padding: 0.5rem 0.75rem;
		cursor: pointer;
		display: flex;
		flex-direction: column;
		gap: 0.1rem;
		min-width: 0;
	}
	.history-load:hover { background: var(--bg); }
	.history-item-active .history-load:hover { background: var(--accent-soft-hover); }
	.history-title {
		font-size: 0.82rem;
		color: var(--text-primary);
		font-weight: 500;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.history-meta {
		font-size: 0.7rem;
		color: var(--text-muted);
	}
	.history-delete {
		background: none;
		border: none;
		color: var(--text-faint);
		cursor: pointer;
		padding: 0.5rem 0.65rem;
		font-size: 0.75rem;
		line-height: 1;
		flex-shrink: 0;
	}
	.history-delete:hover { color: var(--danger); }

	/* ── Body ── */
	.body {
		flex: 1;
		display: grid;
		grid-template-columns: 1fr;
		grid-template-rows: minmax(0, 1fr);
		gap: 0.75rem;
		min-height: 0;
		overflow: hidden;
	}
	.body.with-raw {
		grid-template-columns: 1fr 320px;
	}

	/* ── Thread ── */
	.thread {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
		overflow-y: auto;
		padding: 0.25rem 0.25rem 0.5rem;
		scroll-behavior: smooth;
		min-height: 0;
	}
	.empty {
		margin: auto;
		color: var(--text-muted);
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
		background: var(--accent);
		color: #fff;
		border-bottom-right-radius: 3px;
	}
	.bubble.assistant {
		align-self: flex-start;
		background: var(--surface);
		border: 1px solid var(--border);
		border-bottom-left-radius: 3px;
		color: var(--text-primary);
		max-width: 90%;
		position: relative;
	}

	.copy-btn {
		position: absolute;
		top: 0.5rem;
		right: 0.5rem;
		background: none;
		border: 1px solid var(--border);
		color: var(--text-tertiary);
		padding: 0.25rem 0.5rem;
		font-size: 0.75rem;
		border-radius: 4px;
		cursor: pointer;
		transition: all 0.2s;
		opacity: 0;
		pointer-events: none;
	}
	.bubble.assistant:hover .copy-btn {
		opacity: 1;
		pointer-events: auto;
		background: var(--accent-soft-bg);
		border-color: var(--accent);
		color: var(--accent);
	}
	.text { display: block; }
	/* prose resets for inside bubbles */
	.text :global(p)               { margin: 0.25em 0; line-height: 1.6; }
	.text :global(p:first-child)   { margin-top: 0; }
	.text :global(p:last-child)    { margin-bottom: 0; }
	.text :global(ul), .text :global(ol) { padding-left: 1.4em; margin: 0.4em 0; }
	.text :global(li)              { margin: 0.15em 0; line-height: 1.5; }
	.text :global(code)            { background: var(--accent-soft-bg); color: var(--accent); border-radius: 4px; padding: 0.1em 0.35em; font-size: 0.82em; font-family: 'ui-monospace', monospace; }
	.text :global(pre)             { background: var(--code-bg); color: var(--code-text); border-radius: 8px; padding: 0.75rem 1rem; overflow-x: auto; margin: 0.5em 0; }
	.text :global(pre code)        { background: none; color: inherit; padding: 0; font-size: 0.8em; }
	.text :global(strong)          { font-weight: 700; }
	.text :global(em)              { font-style: italic; }
	.text :global(h1), .text :global(h2), .text :global(h3) { font-weight: 700; margin: 0.6em 0 0.25em; line-height: 1.3; }
	.text :global(blockquote)      { border-left: 3px solid var(--border); padding-left: 0.75rem; color: var(--text-tertiary); margin: 0.5em 0; font-style: italic; }
	.text :global(hr)              { border: none; border-top: 1px solid var(--border); margin: 0.75em 0; }

	/* ── User bubble prose ── */
	.user-prose { display: block; }
	.user-prose :global(p)             { margin: 0.2em 0; line-height: 1.6; }
	.user-prose :global(p:first-child) { margin-top: 0; }
	.user-prose :global(p:last-child)  { margin-bottom: 0; }
	.user-prose :global(code)          { background: rgba(255,255,255,0.2); color: #fff; border-radius: 4px; padding: 0.1em 0.35em; font-size: 0.82em; font-family: 'ui-monospace', monospace; }
	.user-prose :global(pre)           { background: rgba(0,0,0,0.25); border-radius: 6px; padding: 0.6rem 0.8rem; overflow-x: auto; margin: 0.4em 0; }
	.user-prose :global(pre code)      { background: none; color: var(--code-text); padding: 0; font-size: 0.8em; }
	.user-prose :global(strong)        { font-weight: 700; }
	.user-prose :global(em)            { font-style: italic; }
	.user-prose :global(ul), .user-prose :global(ol) { padding-left: 1.4em; margin: 0.3em 0; }
	.user-prose :global(li)            { margin: 0.1em 0; }
	.cursor {
		display: inline-block;
		width: 2px;
		height: 1.1em;
		background: var(--accent);
		margin-left: 1px;
		vertical-align: text-bottom;
		border-radius: 1px;
		animation: blink 0.9s step-end infinite;
	}
	@keyframes blink { 0%, 100% { opacity: 1 } 50% { opacity: 0 } }

	/* ── Tool call card ── */
	.tool-card {
		margin: 0.4rem 0;
		border: 1px solid var(--border);
		border-left: 3px solid var(--accent);
		border-radius: 6px;
		overflow: hidden;
		background: var(--bg);
	}
	.tool-header {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		width: 100%;
		background: var(--accent-soft-bg);
		border: none;
		border-bottom: none;
		padding: 0.3rem 0.6rem;
		cursor: pointer;
		text-align: left;
		font-family: inherit;
	}
	.tool-header[aria-expanded="true"],
	.tool-card:has(.tool-args) .tool-header {
		border-bottom: 1px solid var(--border);
	}
	.tool-card:has(.tool-args) .tool-header { border-bottom: 1px solid var(--border); }
	.tool-icon {
		font-size: 0.78rem;
		color: var(--accent);
		flex-shrink: 0;
	}
	.tool-label {
		font-size: 0.78rem;
		font-weight: 600;
		color: var(--accent);
		flex: 1;
		overflow: hidden;
		white-space: nowrap;
		text-overflow: ellipsis;
	}
	.tool-summary {
		font-weight: 400;
		color: var(--text-tertiary);
	}
	.tool-chevron {
		font-size: 0.7rem;
		color: var(--text-muted);
		flex-shrink: 0;
	}
	.tool-header:hover { background: var(--accent-soft-hover); }
	.tool-args {
		margin: 0;
		padding: 0.45rem 0.6rem;
		font-size: 0.75rem;
		color: var(--text-secondary);
		white-space: pre-wrap;
		word-break: break-all;
		max-height: 240px;
		overflow-y: auto;
		font-family: 'ui-monospace', 'Cascadia Code', monospace;
	}

	/* ── Error ── */
	.error-msg {
		color: var(--danger);
		font-size: 0.82rem;
		background: var(--danger-bg);
		border: 1px solid var(--danger-border);
		border-radius: 6px;
		padding: 0.4rem 0.6rem;
		margin-top: 0.25rem;
	}

	/* ── Raw SSE log ── */
	.raw-log {
		display: flex;
		flex-direction: column;
		background: var(--code-bg);
		border-radius: 10px;
		overflow-y: auto;
		padding: 0.5rem;
	}
	.raw-header {
		font-size: 0.7rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--text-muted);
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
		align-items: stretch;
		flex-shrink: 0;
	}
	textarea {
		flex: 1;
		resize: none;
		border: 1px solid var(--border-strong);
		border-radius: 10px;
		padding: 0.65rem 0.85rem;
		font-family: inherit;
		font-size: 1rem;
		color: var(--text-primary);
		background: var(--surface);
		line-height: 1.5;
		transition: border-color 0.12s;
	}
	textarea:focus { outline: none; border-color: var(--accent); }
	textarea:disabled { background: var(--bg); color: var(--text-muted); }
	.btn-send {
		background: var(--accent);
		color: #fff;
		border: none;
		border-radius: 10px;
		padding: 0 1.25rem;
		font-size: 0.88rem;
		font-weight: 600;
		cursor: pointer;
		transition: background 0.12s;
		flex-shrink: 0;
	}
	.btn-send:hover:not(:disabled) { background: var(--accent-hover); }
	.btn-send:disabled { background: #c7d2fe; cursor: default; }
</style>
