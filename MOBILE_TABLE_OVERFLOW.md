# Mobile Table Overflow — What We Tried & Why It Failed

## Problem
Certain notebook pages (e.g., the Local LLM Agent Plan with a 6-column table) cause horizontal overflow on mobile viewports. The table stretches the page beyond what fits on a phone screen.

## Approaches Tried

### Attempt 1: Simple inline CSS (`+layout.svelte` only) — ✅ Working baseline
- Remove `width: 100%` from `.prose table`, add `min-width: 0`, `overflow-x: auto`
- Add `overflow-wrap: anywhere` / `word-break: normal` on `<th>`/`<td>`
- Add `max-width: 100%; height: auto;` on `.prose img`
- **Result**: Tables squish to fit the viewport. Cell content gets word-wrapped. No horizontal overflow but data is unreadable because columns collapse too much.

### Attempt 2: Table-wrapper div via mdsvex rehype plugin — ❌ Failed
- Wrote a rehype plugin (`rehype-table-wrapper.ts`) to wrap every `<table>` in a `.prose-table-wrapper` div during markdown compilation
- Added CSS for the wrapper with `overflow-x: auto` so wide tables scroll internally
- **Why it failed**: Vite does not hot-reload `vite.config.ts`. After making changes, the dev server needed a restart. Even after restarting, tables were still not wrapped — the rehype plugin was silently failing to apply.

### Attempt 3: Table-wrapper via Svelte action in Note.svelte — ❌ Failed
- Added `$effect` hooks to all four widget components (`Note`, `BusinessPlan`, `FitnessGoals`, `FinanceTracker`) that wrap `<table>` elements in `.prose-table-wrapper` divs at render time
- This approach worked because it runs client-side after DOM is ready, bypassing the mdsvex/Vite issue entirely
- **Why it still failed**: The wrapper CSS removed `width: 100%` from tables (for good reason — they shouldn't be forced to container width), but also removed default margin between table and surrounding prose. Combined with the fact that mdsvex was not rendering via our rehype plugin, there were **no** `.prose-table-wrapper` divs in the DOM at all. The CSS rules for the wrapper were dead — no matching elements existed. Tables rendered with no borders, no styling, falling off the page.

### Attempt 4: Fixing attempt 3 after discovering attempt 3's DOM problem
- Realized widgets weren't getting wrappers because the rehype approach failed + the client-side `$effect` wasn't firing (tables already stripped of CSS)
- Restored table base styles in `+layout.svelte` while trying to add wrapper logic to `BusinessPlan` — accidentally dropped milestones/mission sections from that widget
- **Result**: Regressed BusinessPlan's UI. Had to re-revert to original for BusinessPlan, keeping only the table-wrapping addition

## Current State
All attempts at complex solutions have been abandoned. The user requested reverting to the simple inline fix — pure CSS in `+layout.svelte` with no JavaScript, no wrapper divs, no rehype plugins.

## Remaining Challenge
The simple CSS fix (`min-width: 0`, `overflow-wrap: anywhere`) makes tables fit the viewport but loses readability because columns collapse. A hybrid approach that keeps column widths readable while preventing page overflow hasn't been found yet without resorting to JS-driven wrappers (which is what we just proved doesn't work reliably).

Possible directions to explore next:
- `table-layout: fixed` + explicit `min-width` on `th`/`td` to prevent collapse
- A `<Meta>` element with `width=device-width, shrink-to-fit=no` — not recommended for UX reasons
- Mobile-only CSS that changes table rendering mode (e.g., horizontal stack/cards) at small breakpoints
