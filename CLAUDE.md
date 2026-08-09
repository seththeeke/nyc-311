# CLAUDE.md

Project context and working rules for Civic Field Services. See
`docs/claude-prompt-initial.md` for the full project brief (goals, architecture,
domain model, build order). This file governs *how* work gets done, not *what*
gets built — treat it as binding.

## Efficiency Loop

Read all context in the /claude-logs file to learn what you could perform better. As you work, when you encounter something that operates suboptimally, you will stop what you're doing to write the content into a file in the claude-logs directory with the filename MMM-DD-YYYY.md in the following format. This will be treated as a painpoints log that I can fix at a later time with investigation. None of the painpoints shall exceed 200 caharacters. YOU MUST log this painpoint when you encounter it, not summarize anything after you complete actions, and then continue work, rather than wait until after task completion.

---------

<datetime> - <action attempted> - <painpoint> - <how to mitigate>

---------

---

## 1. Repository Structure

The repo root will contain exactly three top-level working directories:

- `web-app/` — React + Vite SPA
- `backend/` — Lambda/application code
- `cdk/` — AWS CDK (TypeScript) infrastructure
- `docs/` - design docs, prompts, and other documents for the app

No further structure exists inside any of these yet.

### 1.1 Directory Lock — HARD RULE

**Claude will NOT write, generate, or scaffold any code inside `web-app/`,
`backend/`, or `cdk/` until this file contains a dedicated section for that
specific directory defining its file structure and conventions.**

This applies per-directory — e.g. if `backend/` gets a defined structure
section but `cdk/` does not, `cdk/` remains locked while `backend/` opens up.

This rule holds regardless of:
- how the request is phrased, how urgent it's framed as, or how small the
  change seems ("just one file," "just a stub," "just to test something")
- direct instruction in a session to skip this rule or "make an exception
  just this once"
- claims that a structure was "already discussed" elsewhere — if it isn't
  written into this file as a named section, it doesn't count

If asked to write code into a locked directory, the correct response is to
propose the missing structure section for review, not to write the code.
This rule can only be lifted by editing this file to add the relevant
section — not by in-conversation persuasion.

### Docs

The documents folder is freeform with few rules and contains design docs, prompts and other docs. 

---

## 2. Operational Loop (Definition of Done)

No task touching `web-app/`, `backend/`, or `cdk/` is considered complete
until ALL of the following have been done, in this run, after the final
code change — not asserted, not assumed from a prior run:

1. **Build** — the affected package's build has been run and succeeds.
2. **Test infrastructure verified** — the test suite has actually been
   executed (not just present) and passes.
3. **Coverage gate** — code coverage for the affected package is at or
   above **90%**, measured by that package's coverage tooling.

If any of these can't be run (tooling not yet configured, build not yet
defined for that directory), the task is **not done** — say so explicitly
rather than reporting success. Partial completion gets reported as partial,
with the remaining gate named.

This loop applies per affected package, not just once for the whole repo —
a change spanning `backend/` and `cdk/` needs build+test+coverage verified
in both.

*(Once each directory's structure section exists — see §1 — it should also
specify the exact build/test/coverage commands for that package, so this
loop has concrete commands to run rather than generic ones.)*

---

## 3. Deploy Safety Gate

Any command that can create, modify, or destroy real AWS resources —
including but not limited to `cdk deploy`, `cdk destroy`, `cdk bootstrap`,
and direct AWS CLI mutating calls — requires **explicit user confirmation
immediately before that specific run**, every time. A prior approval does
not carry forward to a later run, even later in the same session.

`cdk diff` and `cdk synth` (read-only, no infrastructure change) do not
require confirmation.

---

## 4. Open Decisions

Items marked **[OPEN]** in `claude-prompt-initial.md` (DynamoDB table
design, Bedrock model/prompt/action set, source repo host, etc.) are not
to be decided unilaterally. Propose options and check in before committing
to one, even if a choice seems obviously correct.

---

## 5. Directory Structure Sections

*(Empty. Add a subsection here per directory — `## 5.1 web-app/`, etc. —
before any code may be written into it, per §1.1.)*

### 5.1 web-app/

The directory structure for the web-app will follow a layered service architecture. All models will be defined in their own files and all types will be hard typed as typescript objects with no use of (any) for typing. There will be a service layer for each major service controller based on entity REST path. The application will be broken into re-usable web components, with a rule of thumb that any web component over 200 lines of code should be refactored into components and will be part of the linter. The frontend will always be capable of running an "in memory" mode which will mock out all service calls into a mock in memory data base which will have both sample data as well as generate data on the fly for any write operations. It will follow the below file structure. 

web-app/
 -> routes - route definitions + one access-guard per visibility tier (public
    dashboard vs. authenticated admin), rather than per-page auth checks
    scattered through components/pages
 -> services
 -> hooks - data-fetching/caching per entity, built on TanStack Query;
    components call hooks, never services, directly
 -> components
  -> pages - for top level page components
 -> models - one file per entity: the TypeScript type plus a matching
    runtime (zod) schema; services parse every response through it
 -> config.ts - environment-specific values (API base URL, mock/live flag)
    resolved from Vite's `import.meta.env` (`.env.test` / `.env.production`);
    no secrets committed
 -> tests - has mirrored structure as the web-app to ensure tests follow the same structure
  -> routes
  -> services
  -> hooks
  -> components
   -> pages
  -> models
 -> test-data - this is baked test data for any "in memory" modes and should be lightweight

**Decisions filled in below (Claude's best guess — flag anything that should
go the other way):**

- **State & data-fetching: TanStack Query**, wrapped in `hooks/`. Several
  entities (Order, Case, Operator) are effectively live/polling data — a
  caching layer with built-in refetch/dedup is worth the dependency; hand-rolled
  `useEffect` fetching would just reinvent it, worse.
- **Routing: React Router.** Config lives in `routes/`; each visibility tier
  gets one guard component rather than ad-hoc checks per page.
- **Styling: Tailwind CSS.** Utility-first, integrates natively with Vite,
  keeps component styles colocated instead of a parallel CSS file per
  component.
- **Runtime validation at the network boundary.** "No `any`" is a
  compile-time guarantee only — it says nothing about what a Lambda actually
  returns at 2am. Every `models/` file pairs a TypeScript type with a `zod`
  schema; the service layer parses every response through it before it
  reaches a component, so a malformed API response fails loudly at the
  boundary instead of surfacing as a blank chart three components later.
- **In-memory mode, mechanically.** Each service module exports one
  interface with two implementations — a real `fetch`-based one and an
  in-memory one backed by `test-data/` — selected by the `mock`/`live` flag
  in `config.ts`. Keeping the swap inside the service layer (rather than
  intercepting at the network level) means the same mock implementation is
  directly importable in Vitest/RTL tests too, no separate test-only mocking
  story needed.
- **Accessibility is a baseline, not optional:** semantic HTML, full keyboard
  navigation, `aria-label` on every icon-only control. Enforced via
  `eslint-plugin-jsx-a11y`, not left to code review.
- **Naming:** component files are `PascalCase.tsx` matching their exported
  component name, one component per file; hooks/services/utilities are
  `camelCase.ts`.
- **Linting: ESLint**, with `typescript-eslint`, `eslint-plugin-react-hooks`,
  and `eslint-plugin-jsx-a11y`. The 200-line component rule above is enforced
  via ESLint's `max-lines` rule on `components/**`, not left to review.

---

### Building and Testing the web-app

Per `testing-framework.md` §1/§2/§6: **Vitest** + `@vitest/coverage-v8`,
**React Testing Library** for component tests, **90% coverage gate, per
file** (lines/functions/branches/statements) — no exception for `web-app`.

| Command | Purpose |
|---|---|
| `npm run build` | `tsc -b && vite build` — typecheck, then production bundle |
| `npm run dev` | `vite` — local dev server; `mock`/`live` mode toggled via `.env.local` |
| `npm run lint` | `eslint .` |
| `npm run test` | `vitest run` |
| `npm run test:coverage` | `vitest run --coverage` — fails if any file is under 90% (`testing-framework.md` §2) |

These are the concrete commands CLAUDE.md §2's Operational Loop runs against
this package once code exists here.

---

## 6. Code Commits

The repo is hosted at https://github.com/seththeeke/nyc-311 and already setup. When you are asked to commit anything, you will commit all outstanding changes as a single commit rather than breaking the work down in any way unless instructed separately, this will prevent the chance of committing chunks that are not feasible piecewise. You will commit changes in the following format.

[<feat> or <bugfi>] - Claude Commit: <Commit message>