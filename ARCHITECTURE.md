# Family Net Architecture

## Overview
Family Net is a SvelteKit notebook app with a local AI agent for structured data management and code modifications.

## Project Structure

### Routing & Layout
- **`src/routes/+layout.svelte`** - Main layout with hardcoded sidebar navigation (HTML, not config)
- **`src/routes/+page.svelte`** - Homepage listing notebook entries
- **`src/routes/dev/chat/+page.svelte`** - Chat tester for dev tools (dev-only)
- **`src/routes/dev/chat/+page.server.ts`** - Chat tester server config
- **`src/routes/api/chat/+server.ts`** - Chat API endpoint with server-side tool dispatch

### Navigation Structure (in +layout.svelte)
The sidebar has 3 sections defined as hardcoded HTML:
1. **Notebook** - link to "All entries" (/)
2. **Agents** - currently just Chat tester (/dev/chat, dev-only)
3. **API** - links to OpenAPI/OpenAI/Anthropic schemas

**CRITICAL**: Navigation is NOT defined in a separate config file or data structure. It is hardcoded HTML in `src/routes/+layout.svelte`. To modify navigation, edit this file directly.

### Library Structure
- **`src/lib/components/`** - Reusable Svelte components
- **`src/lib/widgets/`** - Entry type-specific display widgets (Note, BusinessPlan, FitnessGoals, FinanceTracker)
  - **`src/lib/widgets/index.ts`** - Exports widget components and registry. NOT for navigation.
- **`src/lib/server/`** - Server-only code
  - **`src/lib/server/auth.ts`** - API key verification
  - **`src/lib/server/storage.ts`** - Entry CRUD operations
  - **`src/lib/server/ai/`** - AI provider integration
    - **`tools.ts`** - Tool definitions (read_file, write_file, list_dir, search_files, run_command)
    - **`index.ts`** - Provider factory and setup
    - **`providers/`** - OpenAI and Anthropic adapters

### Key Entry Points
- **`vite.config.ts`** - Vite config (currently uses @sveltejs/adapter-auto)
- **`package.json`** - Dependencies and scripts
- **`.env.local`** - Local environment variables (AGENT_API_KEY, ENABLE_DEV_TOOLS)

## Dev Tools & Chat API

### Available Tools (when ENABLE_DEV_TOOLS=true)
- `read_file` - Read file contents (accepts `path` or `file_path`)
- `write_file` - Write or create files (requires `path` and `content`)
- `list_dir` - List directory contents (accepts `path`, `directory`, or `dir_path`)
- `search_files` - Search using git grep (accepts `pattern`, `glob`, `case_sensitive`)
- `run_command` - Execute allowed commands (git, npm, npx, node, tsc, prettier, eslint)

### Tool Iteration Limit
- **`MAX_TOOL_ITERATIONS = 15`** in `src/routes/api/chat/+server.ts`
- If the model reaches this limit, it stops and returns an error

## Common Tasks

### Adding Navigation Links
1. Edit `src/routes/+layout.svelte`
2. Locate the nav section you want to modify (lines 25-44)
3. Add an `<a>` element inside the appropriate `<div class="nav-section">`
4. Use `class="nav-link"` for styling

### Modifying Chat Behavior
1. Edit system prompt in `src/routes/dev/chat/+page.svelte` (lines 37-49)
2. For tools logic, edit `src/routes/api/chat/+server.ts`
3. For tool definitions, edit `src/lib/server/ai/tools.ts`

### Adding a New Entry Type/Widget
1. Create widget in `src/lib/widgets/YourWidget.svelte`
2. Export it from `src/lib/widgets/index.ts`
3. Add to registry in `index.ts`
4. Update `WidgetType` in `src/lib/types.ts`

## Important Constraints

- **Navigation is hardcoded, not configurable** - Always edit `src/routes/+layout.svelte` directly
- **Widgets are for content display only** - They are NOT used for navigation or layout
- **Dev tools only available when ENABLE_DEV_TOOLS=true** - Check environment before using
- **Max 15 tool iterations per request** - Complex multi-step tasks may hit the limit
- **SvelteKit reactivity** - Array mutations must be in-place (.length = 0, .push(), .splice()) not reassignments (= [])
