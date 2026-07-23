## Summary

<!-- One or two sentences: what does this PR do and why? -->

## Changes

<!-- Bulleted list of the user-visible changes. Mention files added, removed,
or refactored. Group by area (UI, API, storage, AI, infra). -->

- [ ] ...

## How to verify

<!-- Concrete steps a reviewer can follow. For UI changes, describe what to
click. For API changes, include a curl example. For storage or env-var
changes, call out which environment to test in. -->

1. ...
2. ...

## Checklist

- [ ] `npm run check` passes
- [ ] `npm test` passes
- [ ] `npm run build` passes
- [ ] No new environment variables introduced (or they're documented in the README)
- [ ] No secrets, tokens, or `.env` values are committed
- [ ] If the agent API changed (`/api/notebook*`, `/api/tools`), the schema was regenerated and tested against at least one LLM provider

## Areas affected

<!-- Tick the areas this PR touches. Helps a reviewer know where to look. -->

- [ ] UI / Svelte components (`src/lib/widgets/`, `src/routes/`)
- [ ] Agent API (`src/routes/api/`)
- [ ] Storage backend (`src/lib/server/storage.ts`)
- [ ] Auth / sessions (`src/lib/server/auth.ts`)
- [ ] AI providers (`src/lib/server/ai/`)
- [ ] Vercel config / deployment
- [ ] Documentation (`README.md`, comments)
