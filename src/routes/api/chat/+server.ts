import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';
import { verifyApiKey } from '$lib/server/auth';
import { getAIProvider } from '$lib/server/ai';
import { getActiveTools } from '$lib/server/ai/tools';
import type {
	AssistantMessage,
	ChatChunk,
	ChatMessage,
	ToolCall,
} from '$lib/server/ai/types';
import { listEntries, readEntry, writeEntry, deleteEntry } from '$lib/server/storage';
import { slugify } from '$lib/markdown';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { execFile as _execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFile = promisify(_execFile);

/**
 * POST /api/chat
 *
 * Streaming chat endpoint with a server-side tool-use loop. Sends a
 * `text/event-stream` body of ChatChunk deltas, terminated by `data:[DONE]`.
 *
 * Auth: bearer token in `Authorization: Bearer ${AGENT_API_KEY}`.
 *
 * Tool dispatch runs under the `agent` identity directly against storage —
 * no per-call HTTP round-trip.
 */

const sseHeaders = {
	'Content-Type': 'text/event-stream',
	'Cache-Control': 'no-cache, no-transform',
	Connection: 'keep-alive',
	'Access-Control-Allow-Origin': '*', // matches /api/tools
	'X-Accel-Buffering': 'no', // disable proxy buffering on Vercel
};

const encode = (chunk: ChatChunk): string => `data: ${JSON.stringify(chunk)}\n\n`;
const done = (): string => `data: [DONE]\n\n`;

const MAX_TOOL_ITERATIONS = 5;
const STREAM_TIMEOUT_MS = 55_000; // sits under Vercel's 60s ceiling

/** Tool dispatch table — calls storage under the agent identity. */
const dispatch: Record<string, (args: Record<string, unknown>) => Promise<unknown>> = {
	list_entries: async (args) => {
		const all = await listEntries('agent', true);
		const typeFilter = typeof args.type === 'string' ? args.type : undefined;
		const visFilter = typeof args.visibility === 'string' ? args.visibility : undefined;
		return all.filter(
			(e) =>
				(!typeFilter || e.type === typeFilter) && (!visFilter || e.visibility === visFilter)
		);
	},

	read_entry: async (args) => {
		const slug = typeof args.slug === 'string' ? args.slug : '';
		if (!slug) return { error: 'slug is required' };
		const entry = await readEntry(slug, 'agent', true);
		return entry ?? { error: `entry not found: ${slug}` };
	},

	write_entry: async (args) => {
		const title = typeof args.title === 'string' ? args.title : '';
		const type = typeof args.type === 'string' ? args.type : 'note';
		const body = typeof args.body === 'string' ? args.body : '';
		if (!title || !body) return { error: 'title and body are required' };

		const slug =
			(typeof args.slug === 'string' && args.slug) || slugify(title) || 'untitled';
		const visibility =
			typeof args.visibility === 'string' ? args.visibility : 'family';
		const tags = Array.isArray(args.tags) ? (args.tags as string[]) : [];

		const today = new Date().toISOString().slice(0, 10);
		const frontmatter: Record<string, unknown> = {
			title,
			type,
			owner: 'agent',
			visibility,
			tags,
			created: today,
			...(args.data && typeof args.data === 'object'
				? (args.data as Record<string, unknown>)
				: {}),
		};

		await writeEntry(slug, frontmatter, body);
		return { slug, title, type, visibility };
	},

	delete_entry: async (args) => {
		const slug = typeof args.slug === 'string' ? args.slug : '';
		if (!slug) return { error: 'slug is required' };
		await deleteEntry(slug);
		return { slug, deleted: true };
	},

	// ── Dev tools (active only when ENABLE_DEV_TOOLS=true) ──────────────────

	search_files: async (args) => {
		const MAX_RESULTS = 50;
		const root    = path.resolve(env.DEV_TOOLS_ROOT || process.cwd());
		// Accept both 'pattern' and 'query' — model sometimes uses the latter
		const pattern = (typeof args.pattern === 'string' ? args.pattern : '') ||
		                (typeof args.query   === 'string' ? args.query   : '');
		if (!pattern) return { error: 'pattern is required' };

		const gitArgs = [
			'grep',
			'--line-number',
			'-I',          // skip binary files
			args.case_sensitive ? '' : '-i',
			'--',
			pattern,
		].filter(Boolean) as string[];

		if ((typeof args.glob === 'string' && args.glob) || (typeof args.file_pattern === 'string' && args.file_pattern)) {
			gitArgs.push(`:(glob)${args.glob ?? args.file_pattern}`);
		}

		try {
			const { stdout } = await execFile('git', gitArgs, {
				cwd: root,
				timeout: 15_000,
				maxBuffer: 256 * 1024,
			});

			const lines = stdout.trim().split('\n').filter(Boolean);
			const results = lines.slice(0, MAX_RESULTS).map((line) => {
				// git grep output: "filepath:lineno:content"
				const firstColon  = line.indexOf(':');
				const secondColon = line.indexOf(':', firstColon + 1);
				if (firstColon === -1 || secondColon === -1) return { raw: line };
				return {
					file: line.slice(0, firstColon),
					line: parseInt(line.slice(firstColon + 1, secondColon), 10),
					content: line.slice(secondColon + 1),
				};
			});

			return {
				pattern,
				matches: results,
				total: lines.length,
				...(lines.length > MAX_RESULTS ? { truncated: true, note: `Showing first ${MAX_RESULTS} of ${lines.length} matches. Narrow with glob or a more specific pattern.` } : {}),
			};
		} catch (e: unknown) {
			const err = e as { code?: number; stderr?: string };
			// git grep exits 1 with no output when there are zero matches — that's not an error
			if (err.code === 1) return { pattern, matches: [], total: 0 };
			return { error: String(e) };
		}
	},

	list_dir: async (args) => {
		const root     = path.resolve(env.DEV_TOOLS_ROOT || process.cwd());
		// Accept 'path', 'directory', or 'dir_path'
		const raw      = ((typeof args.path === 'string' ? args.path : '') ||
		                  (typeof args.directory === 'string' ? args.directory : '') ||
		                  (typeof args.dir_path === 'string' ? args.dir_path : '') || '.').replace(/^[/\\]+/, '') || '.';
		const resolved = path.resolve(root, raw);
		if (!resolved.startsWith(root)) return { error: 'path traversal not allowed' };
		try {
			const entries = await fs.readdir(resolved, { withFileTypes: true });
			return entries.map((e) => ({
				name: e.name,
				type: e.isDirectory() ? 'dir' : 'file',
				path: path.relative(root, path.join(resolved, e.name)).replace(/\\/g, '/'),
			}));
		} catch (e: unknown) {
			return { error: String(e) };
		}
	},

	read_file: async (args) => {
		const MAX_CHARS = 8_000;
		const root = path.resolve(env.DEV_TOOLS_ROOT || process.cwd());
		// Accept both 'path' and 'file_path' — model sometimes uses the latter
		const raw   = ((typeof args.path === 'string' ? args.path : '') ||
		               (typeof args.file_path === 'string' ? args.file_path : '')).replace(/^[/\\]+/, '');
		if (!raw) return { error: 'path is required. Provide the relative path from the project root, e.g. "src/lib/server/ai/tools.ts"' };
		const resolved = path.resolve(root, raw);
		if (!resolved.startsWith(root)) return { error: `path traversal not allowed. Use a path relative to the project root (${root})` };
		try {
			const full  = await fs.readFile(resolved, 'utf-8');
			let lines   = full.split('\n');
			const total = lines.length;

			const startLine = typeof args.start_line === 'number' ? Math.max(1, args.start_line) : 1;
			const endLine   = typeof args.end_line   === 'number' ? Math.min(total, args.end_line) : total;
			lines = lines.slice(startLine - 1, endLine);

			let content  = lines.join('\n');
			let truncated = false;
			if (content.length > MAX_CHARS) {
				content   = content.slice(0, MAX_CHARS);
				truncated = true;
			}

			return {
				path: raw,
				content,
				start_line: startLine,
				end_line: startLine + lines.length - 1,
				total_lines: total,
				...(truncated ? { truncated: true, note: `Output truncated to ${MAX_CHARS} chars. Use start_line/end_line to read other sections.` } : {}),
			};
		} catch (e: unknown) {
			const msg = String(e);
			if (msg.includes('ENOENT')) {
				return { error: `file not found: ${raw}. Use list_dir to confirm the correct path.` };
			}
			return { error: msg };
		}
	},

	write_file: async (args) => {
		const root    = path.resolve(env.DEV_TOOLS_ROOT || process.cwd());
		// Accept both 'path' and 'file_path'
		const raw     = ((typeof args.path === 'string' ? args.path : '') ||
		                 (typeof args.file_path === 'string' ? args.file_path : '')).replace(/^[/\\]+/, '');
		const content = typeof args.content === 'string' ? args.content : '';
		if (!raw) return { error: 'path is required' };
		const resolved = path.resolve(root, raw);
		if (!resolved.startsWith(root)) return { error: 'path traversal not allowed' };
		try {
			await fs.mkdir(path.dirname(resolved), { recursive: true });
			await fs.writeFile(resolved, content, 'utf-8');
			return { path: resolved, written: content.length };
		} catch (e: unknown) {
			return { error: String(e) };
		}
	},

	http_request: async (args) => {
		const MAX_BODY_BYTES = 32 * 1024;
		const baseUrl = (env.HTTP_TOOL_BASE_URL ?? 'http://localhost:5173').replace(/\/$/, '');

		const rawUrl = typeof args.url === 'string' ? args.url : '';
		if (!rawUrl) return { error: 'url is required' };

		const resolvedUrl = rawUrl.startsWith('http://') || rawUrl.startsWith('https://')
			? rawUrl
			: `${baseUrl}${rawUrl.startsWith('/') ? '' : '/'}${rawUrl}`;

		const method = typeof args.method === 'string' ? args.method.toUpperCase() : 'GET';
		const allowedMethods = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']);
		if (!allowedMethods.has(method)) return { error: `method not allowed: ${method}` };

		const reqHeaders: Record<string, string> = {
			'Content-Type': 'application/json',
		};
		if (args.headers && typeof args.headers === 'object') {
			for (const [k, v] of Object.entries(args.headers as Record<string, unknown>)) {
				if (typeof v === 'string') reqHeaders[k] = v;
			}
		}

		const reqInit: RequestInit = { method, headers: reqHeaders };
		if (args.body && typeof args.body === 'string' && method !== 'GET' && method !== 'DELETE') {
			reqInit.body = args.body;
		}

		try {
			const res = await fetch(resolvedUrl, reqInit);
			const text = await res.text();
			const truncated = text.length > MAX_BODY_BYTES;
			const bodyText = truncated ? text.slice(0, MAX_BODY_BYTES) : text;

			let body: unknown;
			try {
				body = JSON.parse(bodyText);
			} catch {
				body = bodyText;
			}

			const resHeaders: Record<string, string> = {};
			res.headers.forEach((v, k) => { resHeaders[k] = v; });

			return {
				status: res.status,
				ok: res.ok,
				headers: resHeaders,
				body,
				...(truncated ? { truncated: true, note: `Response body truncated to ${MAX_BODY_BYTES} bytes.` } : {}),
			};
		} catch (e: unknown) {
			return { error: String(e) };
		}
	},

	run_command: async (args) => {
		const ALLOWED = new Set(['git', 'npm', 'npx', 'node', 'tsc', 'prettier', 'eslint']);
		const rawCmd = typeof args.command === 'string' ? args.command.trim() : '';
		// Allow "git status" as a shorthand — split on whitespace and use the first token.
		const parts = rawCmd.split(/\s+/);
		const cmd   = parts[0];
		const prefixArgs = parts.slice(1);
		const argv  = [...prefixArgs, ...(Array.isArray(args.args) ? (args.args as string[]) : [])];
		if (!ALLOWED.has(cmd)) return { error: `command not allowed: ${cmd}` };
		const cwd = path.resolve(env.DEV_TOOLS_ROOT || process.cwd());
		try {
			const { stdout, stderr } = await execFile(cmd, argv, {
				cwd,
				timeout: 30_000,
				maxBuffer: 512 * 1024,
			});
			return { stdout: stdout.trim(), stderr: stderr.trim(), exitCode: 0 };
		} catch (e: unknown) {
			const err = e as { stdout?: string; stderr?: string; code?: number; message?: string };
			return {
				stdout: err.stdout?.trim() ?? '',
				stderr: err.stderr?.trim() ?? err.message ?? String(e),
				exitCode: err.code ?? 1,
			};
		}
	},
};

export const OPTIONS: RequestHandler = () =>
	new Response(null, {
		status: 204,
		headers: {
			'Access-Control-Allow-Origin': '*',
			'Access-Control-Allow-Methods': 'POST, OPTIONS',
			'Access-Control-Allow-Headers': 'authorization, content-type',
		},
	});

export const POST: RequestHandler = async ({ request }) => {
	if (!verifyApiKey(request)) {
		return new Response('unauthorized', { status: 401 });
	}

	const provider = getAIProvider();
	if (!provider) {
		return new Response('AI provider not configured', { status: 503 });
	}

	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return new Response('invalid JSON body', { status: 400 });
	}

	if (
		!body ||
		typeof body !== 'object' ||
		!Array.isArray((body as { messages?: unknown }).messages)
	) {
		return new Response('messages is required and must be an array', { status: 400 });
	}

	const incoming = body as {
		messages: ChatMessage[];
		model?: string;
		maxTokens?: number;
		temperature?: number;
	};

	const ac = new AbortController();
	const timer = setTimeout(() => ac.abort('timeout'), STREAM_TIMEOUT_MS);

	// The route's tool loop pushes SSE-encoded bytes into the writable side
	// after the Response has been returned (required for SvelteKit streaming
	// to actually stream).
	const transform = new TransformStream<Uint8Array, Uint8Array>();
	const writable = transform.writable;
	const response = new Response(transform.readable, { headers: sseHeaders });

	const encoder = new TextEncoder();

	// Fire-and-forget: write the SSE body on the next tick so the route returns
	// the Response *before* any work happens — that's what unlocks streaming.
	void (async () => {
		const writer = writable.getWriter();
		try {
			await runChatLoop({
				provider,
				writer,
				encoder,
				messages: incoming.messages,
				model: incoming.model,
				maxTokens: incoming.maxTokens,
				temperature: incoming.temperature,
				signal: ac.signal,
			});
		} finally {
			clearTimeout(timer);
			if (ac.signal.aborted) {
				await safeWrite(
					writer,
					encoder.encode(
						encode({ delta: {}, finish_reason: 'timeout' } satisfies ChatChunk)
					)
				);
			}
			await safeWrite(writer, encoder.encode(done()));
			await writer.close().catch(() => undefined);
		}
	})();

	return response;
};

// ---------------------------------------------------------------------------
// Tool-use loop
// ---------------------------------------------------------------------------

interface RunChatLoopArgs {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	provider: any;
	writer: WritableStreamDefaultWriter<Uint8Array>;
	encoder: TextEncoder;
	messages: ChatMessage[];
	model?: string;
	maxTokens?: number;
	temperature?: number;
	signal: AbortSignal;
}

async function runChatLoop(args: RunChatLoopArgs): Promise<void> {
	const { provider, writer, encoder, messages, model, maxTokens, temperature, signal } = args;
	const enc = (chunk: ChatChunk) => encoder.encode(encode(chunk));
	const working: ChatMessage[] = [...messages];

	for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
		const assistantBuffer: AssistantMessage = {
			role: 'assistant',
			content: null,
			tool_calls: [],
			finish_reason: 'stop',
		};
		const toolCallMap = new Map<number, ToolCall>();
		let contentBuf = '';

		let streamError: ChatChunk | null = null;
		let finishReason: ChatChunk['finish_reason'] = undefined;

		try {
			for await (const chunk of provider.chat(
				{
					messages: working,
					model,
					maxTokens,
					temperature,
					stream: true,
					tools: getActiveTools(),
				},
				signal
			)) {
				if (chunk.error) {
					streamError = chunk;
					await safeWrite(writer, enc(chunk));
					break;
				}

				// Forward + accumulate.
				if (chunk.delta.role) {
					await safeWrite(writer, enc({ delta: { role: chunk.delta.role } }));
				}
				if (typeof chunk.delta.content === 'string') {
					contentBuf += chunk.delta.content;
					await safeWrite(writer, enc({ delta: { content: chunk.delta.content } }));
				}
				if (chunk.delta.tool_calls) {
					for (const tc of chunk.delta.tool_calls) {
						const existing = toolCallMap.get(tc.index);
						if (!existing) {
							toolCallMap.set(tc.index, {
								id: tc.id ?? '',
								name: tc.name ?? '',
								arguments: tc.arguments ?? '',
							});
						} else {
							if (tc.id) existing.id = tc.id;
							if (tc.name) existing.name = tc.name;
							if (tc.arguments) existing.arguments += tc.arguments;
						}
					}
					await safeWrite(writer, enc({ delta: { tool_calls: chunk.delta.tool_calls } }));
				}

				if (chunk.finish_reason) {
					finishReason = chunk.finish_reason;
				}
			}
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e);
			await safeWrite(
				writer,
				enc({
					delta: {},
					error: { code: 502, message: msg },
					finish_reason: 'error',
				})
			);
			return;
		}

		if (streamError) break;
		if (signal.aborted) return;

		// Build the assistant message we've been accumulating.
		assistantBuffer.content = contentBuf || null;
		assistantBuffer.tool_calls = Array.from(toolCallMap.values());
		assistantBuffer.finish_reason =
			finishReason === 'tool_calls' || finishReason === 'length'
				? finishReason
				: 'stop';

		// For Hermes-format models (qwen2.5-coder, etc.) the re-prompt works
		// best when the assistant message has its original Hermes JSON as content.
		// The provider suppresses that text so it doesn't reach the client, but we
		// can reconstruct a canonical version here so the model has context.
		if (!assistantBuffer.content && assistantBuffer.tool_calls.length > 0) {
			assistantBuffer.content = assistantBuffer.tool_calls
				.map((tc) => {
					let args: unknown = {};
					try { args = JSON.parse(tc.arguments); } catch { /* keep {} */ }
					return JSON.stringify({ name: tc.name, arguments: args });
				})
				.join('\n');
		}

		// Always emit a terminal chunk with the full message.
		await safeWrite(
			writer,
			enc({
				delta: {},
				finish_reason: assistantBuffer.finish_reason,
				message: assistantBuffer,
			})
		);

		// If not a tool turn, we're done.
		if (assistantBuffer.finish_reason !== 'tool_calls') return;

		// Commit the assistant turn and dispatch tools.
		working.push({
			role: 'assistant',
			content: assistantBuffer.content,
			tool_calls: assistantBuffer.tool_calls,
		});

		for (const call of assistantBuffer.tool_calls) {
			let parsed: Record<string, unknown>;
			let toolResult: unknown;
			let isError = false;

			try {
				parsed = JSON.parse(call.arguments) as Record<string, unknown>;
			} catch {
				parsed = {};
				toolResult = { error: 'invalid JSON arguments' };
				isError = true;
			}

			if (!isError) {
				const handler = dispatch[call.name];
				if (!handler) {
					toolResult = { error: `unknown tool: ${call.name}` };
					isError = true;
				} else {
					try {
						toolResult = await handler(parsed);
					} catch (e) {
						const msg = e instanceof Error ? e.message : String(e);
						toolResult = { error: msg };
						isError = true;
					}
				}
			}

			working.push({
				role: 'tool',
				name: call.name,
				tool_call_id: call.id,
				content: JSON.stringify(toolResult),
			});
		}
	}

	// Iteration cap reached.
	await safeWrite(
		writer,
		enc({
			delta: {},
			finish_reason: 'length',
			message: {
				role: 'assistant',
				content: null,
				tool_calls: [],
				finish_reason: 'length',
			},
		})
	);
}

async function safeWrite(
	writer: WritableStreamDefaultWriter<Uint8Array>,
	chunk: Uint8Array
): Promise<void> {
	try {
		await writer.write(chunk);
	} catch {
		// Client disconnected; nothing to do.
	}
}
