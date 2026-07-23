# Family Net

A markdown-first, agent-driven family notebook. SvelteKit 2 + Svelte 5, deployed to Vercel, with a first-class REST + tool-schema API for LLM agents and a reader-only web UI.

## What it is

Family Net stores notebook entries as markdown files with YAML frontmatter, indexed by URL slug. The web UI is a read-only browser for the notebook. All writes — human or machine — go through the agent API, which LLM agents can discover via the OpenAPI / OpenAI / Anthropic tool schemas at `/api/tools`.

Each entry has a **widget type** that determines how it's rendered:

| Type            | Widget              | Purpose                                |
| --------------- | ------------------- | -------------------------------------- |
| `note`          | `Note`              | Plain markdown, sanitized render       |
| `business-plan` | `BusinessPlan`      | Structured plan view                   |
| `fitness-goals` | `FitnessGoals`      | Goals + milestones view                |
| `finance-tracker` | `FinanceTracker`  | Transaction / budget view              |

Entries are scoped per-user with `visibility: 'private' | 'family'`. Private entries are only visible to their owner; family entries are visible to every signed-in member. Admins can read everything.

## Stack

- **SvelteKit 2** + **Svelte 5** (runes) + **TypeScript** + **Vite 8**
- **`@sveltejs/adapter-vercel`** — serverless functions
- **`@vercel/blob`** — private blob storage (OIDC-authenticated in production, token-authenticated locally)
- **Local filesystem fallback** — `data/entries/*.md` and `data/users.json` when no blob credentials are set
- **`gray-matter`** + **`marked`** — markdown parsing
- **Custom sanitizer** — `src/lib/markdown.ts` powers the `Note` widget (headings, lists, inline code, bold, italic, links; allows `http`/`https`/`mailto`, root-relative, and `#` URLs only; escapes raw HTML)
- **AI providers** — pluggable `openai` (also OpenAI-compatible: Ollama, LM Studio, vLLM), `anthropic`, `ollama`, or `none`

## Configuration

Copy `.env.example` to `.env` and fill in:

| Variable                  | Required | Purpose                                                              |
| ------------------------- | -------- | -------------------------------------------------------------------- |
| `SESSION_SECRET`          | Yes      | HMAC secret for session cookies. `openssl rand -hex 32`              |
| `AGENT_API_KEY`           | Yes      | Bearer token for `/api/notebook*`. `openssl rand -hex 24`            |
| `BLOB_READ_WRITE_TOKEN`   | Prod (opt) | Vercel Blob token. Omit when using OIDC (Vercel injects `BLOB_STORE_ID`) |
| `AI_PROVIDER`             | No       | `none` (default), `openai`, `anthropic`, or `ollama`                 |
| `OPENAI_API_KEY`          | If `openai` | OpenAI key (or any compatible service)                            |
| `OPENAI_BASE_URL`         | No       | Override endpoint — Ollama: `http://localhost:11434/v1`               |
| `ANTHROPIC_API_KEY`       | If `anthropic` | Anthropic key                                                   |
| `AI_MODEL`                | No       | Model override (defaults: `gpt-4o`, `claude-opus-4-5`, `llama3`)     |

First run with no users in storage redirects to `/setup` and creates the first admin.

## Development

```sh
npm install
npm run dev          # vite dev server
```

## Quality checks

```sh
npm run check        # svelte-check + tsc
npm test             # vitest
npm run build        # production build
```

## Deployment (Vercel)

1. Connect the repo to a Vercel project.
2. Attach a Vercel Blob store to the project — this injects `BLOB_STORE_ID` and the OIDC token at runtime. No `BLOB_READ_WRITE_TOKEN` needed in this mode.
3. Set `SESSION_SECRET` and `AGENT_API_KEY` in the project's environment variables.
4. Deploy. `@sveltejs/adapter-vercel` builds the serverless output automatically.

For local dev against a real blob store, set `BLOB_READ_WRITE_TOKEN` to a static read-write token from the Vercel dashboard instead.

## Agent API

All routes under `/api/notebook*` require `Authorization: Bearer ${AGENT_API_KEY}`. The agent identity has admin-level read access.

| Method | Path                    | Description                                     |
| ------ | ----------------------- | ----------------------------------------------- |
| GET    | `/api/notebook`         | List entries (filter by `type`, `visibility`)   |
| POST   | `/api/notebook`         | Create entry (slug auto-derived from title)     |
| GET    | `/api/notebook/{slug}`  | Read full entry (frontmatter + rendered body)  |
| PUT    | `/api/notebook/{slug}`  | Update entry (merges frontmatter, replaces body)|
| DELETE | `/api/notebook/{slug}`  | Delete entry                                    |

### Example

```sh
curl -X POST https://your-deployment/api/notebook \
  -H "Authorization: Bearer $AGENT_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Q3 Family Goals",
    "type": "fitness-goals",
    "visibility": "family",
    "tags": ["fitness", "2026"],
    "body": "## Goals\n- Run a 5k together\n- Weekly hiking",
    "data": { "milestones": ["5k", "10k"] }
  }'
```

## Tool schemas

`GET /api/tools?format=…` returns the four canonical tool definitions (`list_entries`, `read_entry`, `write_entry`, `delete_entry`) in the format the requesting LLM expects:

- `?format=openai` — OpenAI function-calling format
- `?format=anthropic` — Anthropic tool-use format
- `?format=openapi` (default) — OpenAPI 3.1 spec for the REST surface

No auth required — schemas are public so any agent can self-configure.

## Storage backends

`src/lib/server/storage.ts` picks a backend at call time based on env:

- **Vercel Blob** — when `BLOB_STORE_ID` or `BLOB_READ_WRITE_TOKEN` is set. Entries are stored as `entries/{slug}.md` with private access; the SDK uses OIDC when no token is provided.
- **Local filesystem** — fallback for local dev. Files live in `data/entries/{slug}.md`. The `data/` directory is gitignored.

Users are stored the same way: `data/users.json` on disk, or `data/users.json` as a single private blob in production.

## Security notes

- Session cookies are HMAC-SHA256 signed, `httpOnly`, `secure` in production, `SameSite=Lax`, 30-day expiry.
- Passwords are hashed with `scrypt` and a per-user random salt.
- The `Note` widget runs user-supplied markdown through a custom sanitizer — raw HTML is escaped, links are restricted to safe protocols, and `javascript:` URIs are rejected.
- Other widgets render typed, structured data sourced from frontmatter, not raw HTML.
- `AGENT_API_KEY` is the only credential protecting the write API. Rotate it if it's ever exposed.

## Project layout

```
src/
  app.d.ts                 # locals.user typing
  app.html
  hooks.server.ts          # load session into locals
  lib/
    types.ts               # NotebookEntry, User, AuthSession
    markdown.ts            # slugify + sanitizing renderer
    widgets/               # Note, BusinessPlan, FitnessGoals, FinanceTracker
    server/
      auth.ts              # session, password, API key
      users.ts             # user CRUD (blob / fs)
      storage.ts           # entry CRUD (blob / fs)
      ai/
        types.ts
        tools.ts           # canonical tool definitions + format exporters
        providers/         # anthropic, openai
  routes/
    +layout.{server.ts,svelte}     # auth gate
    +page.{server.ts,svelte}       # notebook index
    setup/                         # first-run admin creation
    login/                         # email/password sign-in
    logout/+server.ts
    notebook/[slug]/               # entry reader
    api/
      tools/+server.ts             # tool-schema export
      notebook/                    # REST surface
```

## License

Private.
