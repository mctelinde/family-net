# Family Net

A markdown-first, agent-driven family notebook. SvelteKit 2 + Svelte 5, self-hosted as a single Node process, with a first-class REST + tool-schema API for LLM agents and a reader-only web UI.

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
- **`@sveltejs/adapter-node`** — long-lived Node.js server
- **Local filesystem** — `data/entries/*.md` and `data/users.json`
- **`gray-matter`** + **`marked`** — markdown parsing
- **Custom sanitizer** — `src/lib/markdown.ts` powers the `Note` widget (headings, lists, inline code, bold, italic, links; allows `http`/`https`/`mailto`, root-relative, and `#` URLs only; escapes raw HTML)
- **AI providers** — pluggable `openai` (also OpenAI-compatible: Ollama, LM Studio, vLLM), `anthropic`, `ollama`, or `none`

## Configuration

Copy `.env.example` to `.env` and fill in:

| Variable                  | Required | Purpose                                                              |
| ------------------------- | -------- | -------------------------------------------------------------------- |
| `SESSION_SECRET`          | Yes      | HMAC secret for session cookies. `openssl rand -hex 32`              |
| `AGENT_API_KEY`           | Yes      | Bearer token for `/api/notebook*`. `openssl rand -hex 24`            |
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

## Deployment (self-hosted)

`npm run build` produces a standard Node.js server in `build/`.

```sh
npm run build
node build/index.js
```

Set `SESSION_SECRET` and `AGENT_API_KEY` in your environment (or a `.env` file) before starting. Data is written to `data/` relative to the working directory — mount a persistent volume there in Docker/Compose.

### Docker

```sh
docker run -d \
  -e SESSION_SECRET=<secret> \
  -e AGENT_API_KEY=<key> \
  -v family-net-data:/app/data \
  -p 3000:3000 \
  family-net
```
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

## Storage

All data lives on the local filesystem under `data/` (gitignored):

- **Entries** — `data/entries/{slug}.md` (markdown + YAML frontmatter)
- **Users** — `data/users.json`

Mount `data/` as a persistent volume in production so it survives container restarts.

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
