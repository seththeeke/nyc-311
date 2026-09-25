# UX Workspace Refactor — 3-Panel Shell, Widget Registry, Themes

> **Status (2026-09-21): done, with known follow-ups** (see the last section) —
> the Build Checklist and three rounds of follow-ups are all landed. Negotiated
> question by question, same progressive style as `9-admin-auth-integration.md`
> and `11-street-condition-implementation.md`. `web-app/` is already unlocked
> (`CLAUDE.md` §5.1); this doc is the design plus a build checklist.
>
> Inspiration: two mockups shared in-session — **Option 1** (dark, map-first
> dashboard: left nav, center map, right metric tiles) and **Option 2** (light
> analytics layout). We adopt the **3-panel shell** and the **metric-tile
> column** from them, and nothing else (see §2, non-goals).

---

## Decision Status

| # | Topic | Decision |
|---|---|---|
| 1 | Routing | **Keep every existing URL.** A persistent shell layout route wraps them; sidebar items are links (§3). |
| 2 | Right panel visibility | **Present on every page**, decoupled from the menu selection (§4). |
| 3 | Widget abstraction | **Registry + slot contract**, static secondary content now; all view composition is frontend-only, no backend persistence (§4). |
| 4 | Locked Admin | Accordion expands with lock icons; clicking an item goes to `/login` **inside the shell**, then returns (§5). |
| 5 | Themes | **Design-token themes**; ship `DARK` + `LIGHT`, structure allows more (§7). |
| 6 | Theme scope | **Everything** — all ~50 component files converted (§7.4). |
| 7 | Global chrome | **No top bar**; brand, menu, About, theme toggle, and user/sign-out all live in the sidebar (§3.3). |
| 8 | Mock tiles | Total Requests, Serviced, Total Cost (Est.), Mean Time to Resolve, Median Time to Resolve — all badged WIP (§6). |
| 9 | Collapse + responsive | Both side panels collapse; auto-collapse by width; state is in-memory only (§3.4). |

---

## 1. Goals

1. Replace the top-header + full-page-per-route layout with a persistent
   **3-panel workspace**: collapsible menu drawer (left), primary workspace
   (center), thinner secondary workspace (right).
2. Make views **widgets** — components that can render in either workspace at
   different sizes, so what the secondary workspace shows can become dynamic
   (follow the menu, show compact versions of primary content, or combine
   several views) without reworking the shell.
3. Add **CSS design-token themes** with a light/dark switch that survives a
   reload via browser storage.

## 2. Non-goals (explicit)

- **No filter controls** (Option 1's "Last 7 days" picker and the map legend
  filters, Option 2's settings/scenario tabs).
- **No "Run Simulation"** button or simulation settings form.
- **No large narratives** — no greeting line ("Good morning, let's simulate
  NYC"), no subtitle copy, no hero blurbs added by this refactor.
- **Not adopting** Option 1/2's menu items (Simulation, Requests, Routes,
  Analytics, Settings). The menu is exactly the three in §3.2.
- **No backend persistence of any kind.** Which widgets appear where is
  in-memory frontend state. The only thing stored in the browser is the theme
  (§7.3). No new API routes, no new tables, no `cdk/` or `backend/` changes.
- **No dynamic add/remove/reorder UI** for secondary widgets yet — the
  contract supports it (§4.3); the UI for it is later work.

## 3. Shell layout

### 3.1 Structure

```
┌───────────┬──────────────────────────────┬───────────┐
│ Sidebar   │ Primary workspace            │ Secondary │
│ (drawer)  │ (routed page, <Outlet/>)     │ workspace │
│ ~240px    │ flex-1, scrolls internally   │ ~320px    │
│ 64px rail │                              │ tiles     │
│ collapsed │                              │           │
└───────────┴──────────────────────────────┴───────────┘
```

- The shell is a **layout route** wrapping every existing route. It owns the
  viewport (`h-screen`, no page-level scroll); each workspace scrolls
  independently.
- Existing pages currently assume they own the viewport (`min-h-screen`,
  `h-[calc(100vh-3.5rem)]` in `HomePage`, `MonitoringPage`, `AdminPage`,
  `LoginPage`). Those assumptions are removed; pages fill the primary
  workspace instead.
- Page content is otherwise unchanged apart from theming (§7) and fitting the
  narrower workspace. The tile-grid pages at `/monitoring` and `/admin` keep
  their existing hero copy — this refactor adds no new narrative, and it does
  not delete what exists (see Open Item A).

### 3.2 Menu

Three primary items:

1. **Map** — link to `/`. Primary workspace shows the current fleet map.
2. **System Monitoring** — accordion, six items (all currently on
   `MonitoringPage`):

   | Item | Route |
   |---|---|
   | 311 Request Metrics | `/monitoring/ingestion` |
   | Pipeline | `/monitoring/pipeline` |
   | Lambda Health | `/monitoring/lambda-health` |
   | Test Coverage | `/coverage/index.html` (external — not an SPA route; see Open Item B) |
   | Integration Tests | `/monitoring/integration-tests` |
   | Data Modeling | `/data` |

3. **Admin** — accordion, three items (currently on `AdminPage`), behind the
   lock (§5):

   | Item | Route |
   |---|---|
   | Capacity | `/admin/capacity` |
   | Scheduling | `/admin/scheduling` |
   | Data Warehouse | `/admin/warehouse` |

Active state: the current item is highlighted; an accordion auto-expands when
the current route is inside it. Accordions are independent (both can be open).
Menu items and section definitions live in one typed config array (not inlined
in JSX), so the menu is data-driven.

### 3.3 Sidebar contents

- **Top:** BoroughSim brand + collapse toggle.
- **Middle:** the three menu items.
- **Bottom (replaces the old `Header.tsx` entirely):**
  - **About** button — opens the existing About drawer; `/about` keeps working
    as a shareable link (Map renders underneath, closing returns to `/`),
    exactly as `Header.tsx` does today. `AboutOverlay` itself is reused.
  - **Theme toggle** (§7.3).
  - **Signed-in admin email + Sign out** — visible only when signed in.

Every icon-only control (collapsed rail, toggle, collapse button) carries an
`aria-label`, per `CLAUDE.md` §5.1. Full keyboard navigation: accordion
headers are buttons with `aria-expanded`/`aria-controls`.

### 3.4 Collapse and responsive behavior

| Viewport | Sidebar | Right panel |
|---|---|---|
| ≥ 1024px | Expanded by default, user-collapsible to a 64px icon rail | Expanded by default, user-collapsible (re-open handle stays visible) |
| 768–1023px | As above | **Auto-collapsed**; user can re-open |
| < 768px | Overlay drawer opened by a hamburger; closed by default | Auto-collapsed |

- Collapse state is **in-memory only** (resets on reload). It is *not* put in
  `localStorage` — only the theme is (§7.3).
- A manual toggle overrides the auto-collapse until the next breakpoint
  crossing.
- In the collapsed rail, clicking an accordion group's icon expands the
  sidebar with that accordion open (default; see Open Item C).

## 4. Workspaces and the widget contract

### 4.1 Primary workspace

The routed page (`<Outlet/>`). Unchanged conceptually: the menu selects a
route, the route renders in the primary workspace.

### 4.2 Secondary workspace

A fixed-width panel present on **every** route. It is **not driven by the
route or the menu selection.** Its content is a list of widget IDs held in
in-memory state and rendered through the registry. For now that list is a
code-defined default (§6); nothing about the shell assumes the list is fixed
or route-independent.

### 4.3 Widget registry and slot contract

The intent is "build widgets usable in both workspaces; let what renders where
become dynamic later." Concretely:

- **`WidgetSize`** — `"TILE" | "PANEL" | "FULL"` (values `ALL_CAPS` per
  `CLAUDE.md` §6). `TILE` = compact card (secondary workspace); `FULL` =
  fills the primary workspace; `PANEL` = in-between, reserved for combining
  views into a subspace later.
- **`WidgetDefinition`** — `id: WidgetId`, `title`, `status: "LIVE" |
  "WORK_IN_PROGRESS"`, `sizes: WidgetSize[]` (which sizes it supports), and
  `component: ComponentType<WidgetProps>`.
- **`WidgetProps`** — `{ size: WidgetSize }`. A widget decides how to render
  itself at the size it's given; it doesn't know which workspace hosts it.
- **Registry** — one map `WidgetId → WidgetDefinition`, the single place a
  widget is registered. `getWidget(id)` throws a typed error on an unknown id
  (fail loudly, no silent blank tile).
- **`WidgetSlot`** — `<WidgetSlot widgetId size />` looks up the widget,
  validates `size` is in its `sizes`, and renders it inside a shared card
  frame (title, WIP badge when `status` is `WORK_IN_PROGRESS`). Both
  workspaces render widgets *only* through `WidgetSlot`.
- **Workspace state** — a small provider exposing `secondaryWidgetIds` and
  setters (`setSecondaryWidgets`, `addSecondaryWidget`,
  `removeSecondaryWidget`), initialised from a default constant. **No setter
  is wired to any UI in this refactor**; they exist so a later "follows the
  menu" or "user-composed subspace" feature is a data change, not a rewrite.
  In-memory only.

To prove the contract works in *both* workspaces, the Map route's primary
content renders through it too: a `FLEET_MAP` widget (`FULL`) — see Open Item
D. All other existing pages stay ordinary routed pages; registering them as
`FULL` widgets is future work.

`components/` files are capped at 200 lines by the ESLint `max-lines` rule
(`CLAUDE.md` §5.1); the shell is split accordingly (§9).

## 5. Admin lock and auth

Auth mechanics are **unchanged**: Cognito (live) / in-memory (mock) via
`useAuth`/`authService`, the custom `LoginPage` form including the
`NEW_PASSWORD_REQUIRED` flow, `AdminRoute` as the one access guard for the
admin tier, and the JWT authorizer on the admin API routes
(`9-admin-auth-integration.md`).

I read "remain authenticated against those admin endpoints for security" as:
**the lock icon is a UI affordance, not the security boundary.** The real
enforcement stays where it is — `AdminRoute` on the client and the JWT
authorizer server-side. Nothing here weakens either. (Flag if you meant
something different.)

Behavior:

| State | Admin accordion | Admin items |
|---|---|---|
| Signed out | Shows a **lock icon**; expands normally | Each item shows a lock icon |
| Signed out, item clicked (or deep link to `/admin/*`) | — | Navigates to the path; `AdminRoute` redirects to `/login` (preserving `from`), rendered **in the primary workspace** with sidebar and right panel intact |
| Signed in | No lock icon | Live links |

- After sign-in, `LoginPage` returns the visitor to `from` (existing
  behavior), so the item they clicked opens.
- Signing out (sidebar footer) while on `/admin/*` triggers `AdminRoute`'s
  existing redirect to `/login`.
- `LoginPage` drops its `min-h-screen` full-page layout and hard-coded light
  styling; it renders as a centered form inside the primary workspace, themed
  like everything else.
- Lock/unlock state works identically in mock mode (`authService`'s in-memory
  implementation).

## 6. Right panel content

Order, top to bottom:

| Widget id | Status | Content |
|---|---|---|
| `CAPACITY` | **LIVE** | The existing total-capacity number (operator count from `useFleetLocations`), moved off the map overlay into a tile |
| `TOTAL_REQUESTS` | WIP | Big number + delta line |
| `SERVICED` | WIP | Big number + completion % |
| `TOTAL_COST_EST` | WIP | Dollar figure + delta line |
| `MEAN_TIME_TO_RESOLVE` | WIP | Duration figure |
| `MEDIAN_TIME_TO_RESOLVE` | WIP | Duration figure |

(Mean and median were chosen for the two resolve-time tiles: mean is pulled up
by slow outliers, median is the typical case.)

- **WIP tiles are hard-coded sample values — no service calls, no hooks, no
  backend.** They live as static constants next to the widget code, not in the
  in-memory-mode `test-data/` (that directory is for mock service data).
- Every WIP tile shows a visible **WIP** badge (tooltip: "Work in progress") in its card frame
  (rendered by `WidgetSlot` from `status`, so a tile can't forget it), and its
  registry `status` is `"WORK_IN_PROGRESS"` (greppable). A test asserts every
  WIP-status widget renders the badge.
- When implemented, log **one backlog item** (`log-backlog-item` skill)
  covering the five WIP tiles, so they don't get lost — the badge is the
  in-product reminder, the backlog item is the tracked one.
- `CapacityTile` (the map overlay) is removed from `HomePage`; the map is no
  longer overlaid by it. The loading/error pills over the map stay.

## 7. Themes

### 7.1 Model

- A **theme is a named set of semantic design tokens**, applied by a
  `data-theme` attribute on `<html>`. Components use semantic tokens (e.g.
  `surface`, `panel`, `panel-raised`, `border`, `fg`, `fg-muted`, `accent`,
  plus status colors), never raw palette classes.
- Tokens are CSS variables declared in `index.css` and exposed to Tailwind v4
  via `@theme`, so utilities like `bg-panel` / `text-fg-muted` work.
- `ThemeName` is `"DARK" | "LIGHT"` (`ALL_CAPS`, per `CLAUDE.md` §6); the
  attribute selector is `[data-theme="DARK"]` etc. Adding a third theme later
  = one new token block + one new `ThemeName` value.

### 7.2 Default

Stored value if present → else the OS `prefers-color-scheme` → else `DARK`
(today's look). See Open Item E.

### 7.3 Persistence

- Stored in `localStorage` under one key (e.g. `nyc311.theme`) — a plain
  per-browser value. No backend, no cookie.
- Every storage read/write is wrapped in `try/catch`; if storage is
  unavailable (private window, blocked), the app still works and falls back to
  the default for the session.
- The theme is applied **before first paint** by a tiny inline script in
  `index.html`, to avoid a flash of the wrong theme. A `useTheme` hook (React
  context) exposes `theme` and `setTheme`/`toggleTheme` to the sidebar toggle.
- Toggle: icon button in the sidebar footer with `aria-label` and
  `aria-pressed`.

### 7.4 Scope: everything

All ~50 component files that hard-code palette classes
(`bg-slate-950`, `text-slate-300`, `border-white/10`, `text-white`, …) move to
tokens, so no page is broken in either theme. Specific items:

- **Chart/data-encoding colors** — `components/ingestion/palette.ts` states
  its `IV_COLORS` are "light-mode only" and validated via the dataviz
  skill's palette validator. It gets light and dark variants, each validated
  the same way (contrast + CVD distinguishability) — not eyeballed.
- **Leaflet map** — `FleetMap` currently uses OSM tiles only. Dark theme needs
  a dark basemap; see Open Item F.
- **Aurora/grid decorative backgrounds** on `MonitoringPage`/`AdminPage`
  are theme-aware (kept in `DARK`, subdued in `LIGHT`) rather than dropped.
- **`LoginPage`** — currently light-only; see §5.
- **Enforcement:** an ESLint rule (`no-restricted-syntax` on className string
  literals matching raw palette classes) so the conversion can't quietly
  regress. Proposed, not yet designed in detail — see Open Item G.

## 8. Removed / replaced

| Today | After |
|---|---|
| `components/Header.tsx` (top banner) | Removed; replaced by the sidebar (§3.3) |
| `components/CapacityTile.tsx` (map overlay) | Removed; replaced by the `CAPACITY` widget (§6) |
| `/monitoring` and `/admin` tile-grid pages as the way to reach sub-pages | Menu accordions are the primary navigation; the pages remain as routes (Open Item A) |

## 9. Proposed file structure

Follows `CLAUDE.md` §5.1 — no new top-level directories under `web-app/src/`;
new folders sit under existing ones, and tests mirror the tree.

```
web-app/src/
  routes/
    ShellRoute.tsx          layout route wrapping all existing routes
  hooks/
    useTheme.ts             (+ ThemeProvider context)
    useWorkspace.ts         secondaryWidgetIds state + setters
    useMediaQuery.ts        breakpoint-driven auto-collapse
  models/
    theme.ts                ThemeName type + zod schema (validates stored value)
    widget.ts               WidgetId, WidgetSize, WidgetStatus + zod schemas
  components/
    shell/                  WorkspaceShell, Sidebar, SidebarMenu,
                            SidebarAccordion, SidebarFooter, ThemeToggle,
                            SecondaryWorkspace, menuConfig.ts
    widgets/                widgetRegistry.ts, WidgetSlot, WidgetCard,
                            WipBadge, CapacityWidget, FleetMapWidget,
                            mock/ (five WIP tile components + sample constants)
  index.css                 token blocks per theme + @theme mapping
```

- `models/widget.ts` holds the serializable pieces (ids, sizes, status). The
  registry itself holds component references, so it lives in
  `components/widgets/`, not `models/`.
- The stored-theme value is parsed through `models/theme.ts`'s zod schema, so
  a garbage/old localStorage value falls back to the default instead of
  crashing.

## 10. Testing

Per `CLAUDE.md` §2 and `testing-framework.md`: Vitest + RTL, **90% coverage
per file**, tests mirror the source tree, in-memory (mock) mode throughout.

- **Theme:** stored value applied; invalid stored value → default; storage
  throwing (get and set) → still works; toggle updates `data-theme` and
  storage.
- **Sidebar:** accordion expand/collapse, `aria-expanded`, auto-expand for the
  current route, active highlight, rail collapse, hamburger overlay below
  768px (mock `matchMedia`).
- **Lock:** signed-out shows lock icons on Admin and its three items; clicking
  one ends on `/login` in the shell; sign-in returns to the original path;
  signed-in shows no lock; sign-out on `/admin/*` redirects.
- **Widgets:** registry returns all six ids; unknown id throws; unsupported
  `size` rejected; every WIP-status widget renders the badge; `CAPACITY`
  shows the count and a loading state.
- **Shell:** right panel is present on every route; auto-collapse by width;
  manual toggle overrides.
- Existing tests for `Header`, `CapacityTile`, and page layout assumptions are
  updated or removed with the code they cover.

Definition of done is `CLAUDE.md` §2's loop on `web-app/`: `npm run build`,
`npm run lint`, `npm run test`, `npm run test:coverage` (≥ 90% per file), run
after the final code change. No `cdk/` or `backend/` package is affected.

## Open Items (need your call before or during build)

Defaults below are what I'll do unless you say otherwise.

- **A. `/monitoring` and `/admin` tile-grid pages.** You chose "keep URLs,
  shell wraps them," so they stay as routes — but with the accordions they're
  now redundant. Default: keep as-is (themed), accordion headers only toggle
  and don't navigate to them; revisit deleting them later.
- **B. Test Coverage is not an SPA route** (`/coverage/index.html`, a
  separately hosted static report). Default: menu item opens it in a new tab
  with an external-link icon, since loading it inside the shell would drop the
  sidebar/panels.
- **C. Collapsed-rail accordions.** Default: clicking a group's icon expands
  the sidebar with that group open (no flyout menus).
- **D. `FLEET_MAP` as a registered widget.** Default: yes, Map renders through
  the registry as a `FULL` widget to prove the dual-use contract. Alternative:
  leave the map as a plain page and register only tiles now.
- **E. First-visit theme default.** Default: OS preference, else `DARK`.
  Alternative: always `DARK` until the user toggles.
- **F. Dark map basemap.** Default: keep OSM tiles and darken them with a CSS
  filter on the tile pane in `DARK` — no new third-party tile provider.
  Alternative: a purpose-built dark basemap (e.g. CARTO Dark Matter), which
  looks better but adds an external dependency and attribution.
- **G. Lint enforcement for theme tokens.** Default: add the
  `no-restricted-syntax` rule as part of this refactor (after the conversion,
  so it lands green). Alternative: convert without a guard.
- **H. Right-panel width.** Default ~320px expanded (≈ Option 1's tile column);
  tune when seen at real viewport sizes.

## Build Checklist

Ordered so each step leaves the app working.

1. [x] Theme foundation — token blocks in `index.css`, `@theme` mapping,
   `models/theme.ts`, `useTheme`, pre-paint script in `index.html`.
2. [x] Convert existing components/pages to tokens (all ~50 files), including
   chart palette light/dark variants (validated) and map tile handling; app
   still runs with the old header during this step.
3. [x] Widget foundation — `models/widget.ts`, registry, `WidgetSlot`,
   `WidgetCard`, `WipBadge`, workspace provider.
4. [x] Widgets — `CapacityWidget`, `FleetMapWidget`, five WIP tiles (hard-coded).
5. [x] Shell — `ShellRoute`, `WorkspaceShell`, `Sidebar` (menu, accordions,
   lock, footer), `SecondaryWorkspace`, collapse + responsive behavior.
6. [x] Route wiring — wrap existing routes in `ShellRoute`; render `LoginPage`
   in the workspace; remove viewport-height assumptions from pages.
7. [x] Remove `Header.tsx` and `CapacityTile.tsx`; keep `/about` working via
   the sidebar About button.
8. [x] ESLint token-guard rule (Open Item G).
9. [x] Tests for all of the above; update/remove obsolete tests.
10. [x] Operational loop on `web-app/`: build, lint, test, coverage ≥ 90% per file.
11. [x] Log the WIP-tiles backlog item (`log-backlog-item`) — [#41](https://github.com/seththeeke/nyc-311/issues/41).

**Build notes (2026-09-21).** All checklist items built. Operational Loop on
`web-app/` passed after the final code change: `npm run build`, `npm run lint`,
843 tests, coverage ≥ 90% per file. **Not yet done:** a visual check in a real
browser (the Chrome extension wasn't connected) — worth eyeballing both themes,
the collapsed rail, the narrow-width overlay, and the map's dark tiles. Nothing
under `backend/` or `cdk/` was touched, and nothing is committed.

## Follow-ups (2026-09-21, after first review)

Five housekeeping changes from the first look at the running app:

1. **Hover tooltips on every clickable control.** One app-wide `TooltipLayer`
   (mounted in `WorkspaceShell`) shows a tooltip after ~350ms for any button,
   link, tab, or accordion header — text from `data-tooltip`, else `aria-label`,
   else visible text; elements with a native `title` are skipped. New buttons get
   it with no per-component wiring. Buttons also get the pointer cursor back
   (Tailwind v4 preflight removes it).
2. **About toggles.** The sidebar About button opens and closes the drawer
   (`aria-expanded` reflects state); Close and Escape still work. At `/about`,
   toggling closed also returns to `/`.
3. **One page width.** Every content page uses `PAGE_CONTENT_CLASSES`
   (`components/pageLayout.ts`: full workspace width, `px-6 py-10`) instead of
   its own `max-w-*` column, so header and content no longer change width
   between pages. `LoginPage` (narrow form) and `HomePage` (full-bleed map) are
   the only exceptions; a test guards against per-page `max-w-` columns coming back.
4. **Rename:** System Monitoring's "Data Warehouse" is now **Data Modeling**
   (menu and the matching tile on `/monitoring`). Admin's "Warehouse" is unchanged.
5. **Compact secondary tiles.** Tiles are smaller and sit **two per row**
   (`grid-cols-2`); the badge reads **WIP**.

## Follow-ups, round 2 (2026-09-21)

1. **Menus start expanded.** Both accordions open on load (room to spare); the
   user can still collapse either, and a route change into a section re-opens it.
2. **Rename:** the Ingestion menu item and its `/monitoring` tile are now
   **NYC 311 Ingestion Metrics** (the page heading is unchanged).
3. **Relationship diagram on Data Modeling.** `/data` shows a "Relationships"
   section above the schema list: an SVG diagram built on the fly from the same
   `GET /data/schema` response (no extra call), so it tracks the catalog.
   **The Glue catalog declares no foreign keys**, so they're *inferred* from
   `*_id` naming (`schemaRelationships.ts`): a table's entity is its name minus
   `_events`/`_snapshots` and a plural "s"; the non-events table owns
   `<entity>_id`; any other `*_id` column ending in a known entity is an FK to
   it (`assigned_operator_id` → `operator_snapshots.operator_id`). Ids with no
   matching table (`case_id` today) are skipped. Children sit left of the tables
   they reference; a toggle switches key-columns-only / all columns. Not fancy:
   no drag, no edge routing around boxes. If real FKs are ever declared (e.g. in
   column comments), only `inferRelationships` needs to change.
4. **Theme switch** is a two-option radio group — sun (light) on the left, moon
   (dark) on the right, active side highlighted; vertical in the collapsed rail.
5. **One "glass" look.** A shared `.glass` class (translucent fill, backdrop
   blur, hairline border, edge highlight; token-driven so it works in both
   themes — the light theme's panel fill is now translucent too) now styles the
   Admin cards (Capacity, Scheduling, Warehouse: query workspace, forms, results,
   roster), the Data-page schema panels, the monitoring page sections and tiles,
   and the secondary-workspace widgets.
6. **Ingestion Volume widget** in the secondary workspace: a compact,
   label-free version of the volume chart (last 24 runs, same three series
   colors). It calls the same `usePollerMetrics` hook — same TanStack Query key —
   as the Ingestion page, so they share one cached response and one refetch
   timer (a test renders both and asserts a single fetch). Tiles can now declare
   `tileSpan: 2`; this one spans both columns. **Side effect:** the widget lives
   in the always-present right panel, so the poller-metrics query (60s refetch)
   now runs on every page while the panel is open, not just on the Ingestion page.

## Follow-ups, round 3 (2026-09-21)

1. **About + theme on one line.** In the sidebar footer the About button and the
   sun/moon switch share a single row (About takes the remaining width). The
   collapsed rail is too narrow for that, so there they stack.
2. **Fleet map legend.** A small floating key under the map's +/- controls: a
   truck in each marker colour with what it means (Idle — available, In transit —
   heading to a job, Working — on a job). Colours come from one shared
   `fleetActivityStyle.ts`, so the legend and the markers can't drift.
3. **Two more WIP widgets** (mock data, `WIP` badge, both span the panel width):
   **Orders by Status** (pie: Completed / Scheduled / In progress / Rejected) and,
   below it, **Fleet Utilization** (left-to-right stacked bar: Working / In
   transit / Idle). Both use the validated categorical palette (a fourth slot was
   added for the pie; `IV_COLORS.seriesFourth`) with a legend of names and
   percents, so nothing is colour-only. *Why not the map's truck colours for the
   bar:* they fail the validator's dark-mode lightness band, so the bar uses the
   validated series colours instead — it's a one-line swap if that trade-off
   should go the other way. Logged with the other WIP tiles in #41.
4. **Loading state.** "Loading fleet…" is now a large (3xl) message with a bigger
   spinner, centered over the map. The error message moved to top-center so it
   no longer sits on the zoom controls or legend.
5. **Brand mark.** A large solid map-marker icon beside "BoroughSim" in the
   sidebar header; it stands alone in the collapsed rail.
6. **Rename:** Admin's "Warehouse" is now **Data Warehouse** (menu, tile, and
   page heading).
7. **Rename:** "NYC 311 Ingestion Metrics" is now **311 Request Metrics** (menu
   and tile; the page heading is still "Ingestion").

## Known follow-ups

The refactor is considered done; these are the things deliberately left open.

- **Replace the seven WIP mock tiles with real data** — tracked in
  [#41](https://github.com/seththeeke/nyc-311/issues/41). Includes deciding what
  "resolved" means for the time-to-resolve tiles.
- **Visual review in a real browser.** All checks so far were automated (build,
  lint, tests, coverage) plus your own look at the dev server; nothing was
  screenshot-verified. Worth a deliberate pass over: light theme with the
  now-translucent panels, the relationship diagram's layout, the collapsed rail,
  the narrow-width overlay, and the dark map tiles.
- **Relationship diagram uses inferred keys.** The Glue catalog declares no
  foreign keys; the diagram infers them from `*_id` names. If real keys are ever
  declared (e.g. in column comments), only `inferRelationships` changes.
- **Fleet Utilization bar doesn't match the map's truck colours** (now live —
  see round 4 below). Those colours fail the palette validator's dark-mode
  lightness band, so the bar uses the validated series colours instead. Revisit
  if the map colours are ever themed.
- **Poller-metrics query now runs on every page** while the right panel is open
  (the Ingestion Volume widget shares the Ingestion page's cache key, so it is
  still one call and one 60s refetch timer, just no longer confined to one page).
- **Open Item A still stands:** `/monitoring` and `/admin` tile-grid pages are
  redundant with the menu accordions but kept as routes.
- **Naming drift:** the menu item is "311 Request Metrics" but its page heading
  is still "Ingestion".
- **Secondary workspace is static.** Widget add/remove/reorder setters exist in
  workspace state but no UI is wired to them, by design.

## Follow-ups, round 4 (2026-09-22)

**Fleet Utilization is now LIVE**, not mock. It's computed entirely from
`useFleetLocations` — the same query (and cache) the map, its legend, and
`CapacityWidget` already use — counting each Operator's `current_activity`
(`WORKING`/`TRANSIT`/`IDLE`) and turning the counts into shares with the same
`chartShares.ts` math the Orders-by-Status pie uses. No new backend call, no
new hook. All three activities always show, even at 0%, so the legend doesn't
reshuffle as the fleet moves. `chartShares.ts` and `ShareLegend.tsx` moved out
of `widgets/mock/` to `widgets/` (shared by a mock and a live widget now,
so "mock" no longer described them); `mockChartData.ts` keeps only the
Orders-by-Status sample data. Six of the original nine secondary-workspace
tiles remain WIP (tracked in #41): Total Requests, Serviced, Total Cost
(Est.), Mean/Median Time to Resolve, and Orders by Status.

**Orders by Status removed (2026-09-25).** The WIP pie tile is gone from the
secondary workspace, along with its mock data (`mockChartData.ts`), its
`ORDERS_BY_STATUS` widget id, and the now-unused `slicePath` pie helper in
`chartShares.ts`. Five WIP tiles remain (#41).
