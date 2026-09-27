# Agent Orchestration — spec

> **Status: spec only — 2026-09-27.** Nothing built yet. Decisions below were
> settled one at a time with the user (2026-09-26/27). Build starts next
> session. Supersedes the launchd-based setup in `agent-automation-setup.md`
> once the migration (§12) completes.

## 1. What this is

A small, **localhost-only** full-stack app (`nyc-311/agent-orchestration/`)
that **schedules and monitors** Claude Code agents: "run `devx-agent` in
`~/Documents/projects/nyc-311` at 06:00 and 18:00 with prompt *Go*", then
shows each run live, its result, cost, and any permission denials.

### Design principle (binding)

**The orchestrator is a project-agnostic scheduler and monitor.** A schedule
is *project directory + agent name + cron + prompt*. The tool never defines or
alters an agent's behavior or permissions — everything an agent does comes
from its own project (`.claude/agents/*.md`, the project's settings/hooks,
its git-committed allowlist), so an agent behaves identically whether started
by the tool or by hand. Any project with a `.claude/agents/` directory can be
scheduled.

The one exception is recorded as debt in §6.

### Non-goals

- No hosting — binds `127.0.0.1` only, never deployed anywhere.
- No agent logic: no PR limits, modes, prompts-by-condition. Those live in the
  agent's own `.md` (e.g. devx-agent's 3-open-PR rule, §12).
- No permission management — no allowlist editing, no bypass modes.
- No shared agent memory (not needed yet).
- No catch-up/backfill of missed runs; no recovery of interrupted runs.
- No long-lived Claude processes: every run is one short `claude -p` process.

## 2. Decision log

| # | Topic | Decision |
|---|---|---|
| 1 | Agent runtime | **`claude` CLI** (`-p`, `--output-format stream-json --verbose`), not the Agent SDK. Same binary; the stream gives live tool calls, `permission_denied` events, and a final `result` (report, cost, duration, session id, `permission_denials`). SDK-only `canUseTool` live approval would keep runs alive waiting — contrary to short-lived runs — and the SDK's documented auth is API-key billing. Runner sits behind one interface so an SDK runner could be swapped in later. |
| 2 | Storage | **SQLite via built-in `node:sqlite`** (verified on Node v26.10.0; no native build — npm here blocks install scripts, which `better-sqlite3` needs). DB **outside the repo**: `~/.agent-orchestration/orchestrator.db` (override `AGENT_ORCH_DATA_DIR`). JSON export/import of schedules is a later nice-to-have. |
| 3 | Agent-specific rules | **Live in the agent**, not the tool. devx-agent's open-PR limit and NEW/REVISE mode move into `devx-agent.md`; a schedule's prompt can be just "Go". |
| 4 | Run rules | (a) per-schedule max runtime, default **60 min** → SIGINT, 30 s grace, SIGTERM, status `TIMED_OUT`; (b) same schedule still running when due → **skip**, `SKIPPED`; (c) global concurrency cap, default **4**, FIFO queue; (d) **Run now** button, same rules; (e) runs are child processes — stopping the server SIGINTs them → `ABORTED`, no re-adoption. Missed runs while the server is down are simply not run. |
| 5 | Permissions | **Stay in the project, in git.** The tool always adds `--permission-prompts none` (anything not allowed is denied, never prompted, not retried) and nothing else. Never `--dangerously-skip-permissions` / `bypassPermissions`. UI surfaces denials with the exact rule text to copy into the project's allowlist via a normal commit. |
| 6 | Invocation | Run the agent **in its project directory**, plain. Isolation (worktrees) is the agent's own job (§12). |
| 7 | Stack | **One npm package**; **Fastify** server; **croner** scheduler; `node:sqlite`; UI = same stack/rules as `web-app` (React, Vite, TanStack Query, React Router, Tailwind, zod, ESLint + jsx-a11y + 200-line components); live views via **polling** (TanStack `refetchInterval`), SSE later if needed. |
| 8 | Run modes | `npm start` = the long-running "production on this machine" instance; separate dev modes that can't affect running agents (§9). |

## 3. Architecture

```
browser ──► 127.0.0.1:4311  Fastify (npm start)
                 ├─ /api/*        controllers → services → dao (SQLite)
                 ├─ /             built UI (web/ → dist)
                 ├─ scheduler     croner, one job per enabled schedule
                 └─ runner        queue (cap 4) → spawn `claude -p …` per run
                                   └─ stream-json → ~/.agent-orchestration/runs/<runId>.jsonl
```

One Node process. Schedules load from SQLite at startup and are re-registered
whenever one is created/edited/toggled. A cron tick enqueues a run; the queue
starts it when a slot is free.

### 3.1 The exact invocation

```
cd <projectDir> && claude -p \
  --agent <agentName> \
  --permission-prompts none \
  --output-format stream-json --verbose \
  [--settings .claude/agent-settings/<agentName>.json]   # only if the file exists — §6
  "<prompt>"
```

No other flags, env, or files are added. `claude` is resolved from `PATH` at
startup (fail loudly if missing); requires Claude Code ≥ 2.1.259 for
`--permission-prompts`.

### 3.2 Run lifecycle

Statuses (ALL_CAPS per CLAUDE.md §6): `QUEUED → RUNNING → SUCCEEDED | FAILED |
TIMED_OUT | ABORTED`, plus `SKIPPED` (never started — reason recorded).

- **SUCCEEDED**: exit 0 and a `result` event with subtype `success`.
- **FAILED**: non-zero exit, or a `result` with an error subtype, or spawn
  failure (bad project dir, missing agent, `claude` not found).
- **TIMED_OUT**: max runtime hit (SIGINT → 30 s → SIGTERM, exit 143).
- **ABORTED**: stopped by the user (**Stop** button) or server shutdown.
- **SKIPPED**: this schedule already had a `QUEUED`/`RUNNING` run.

On server startup, any run still `RUNNING`/`QUEUED` in the DB (from a crash)
is marked `ABORTED` — no re-adoption.

### 3.3 Stream handling

Each stdout line is one JSON event. Every line is appended verbatim to the
run's `.jsonl` file (the full record) and parsed through a **lenient** zod
schema: known types (`system/init`, `assistant`, `user` tool results,
`system/permission_denied`, `system/api_retry`, `result`) are extracted for the
DB summary; unknown types are kept in the file and ignored — the CLI adds event
types over time and must never break a run. Stderr goes to
`<runId>.stderr.log`.

## 4. Data model

TS type + zod schema per entity in `shared/models/` (one file each), used by
both server and UI.

**Schedule**
| field | notes |
|---|---|
| `id` | uuid |
| `name` | display name, e.g. "devx twice daily" |
| `projectDir` | absolute path; must exist and contain `.claude/agents/` |
| `agentName` | must match an agent in `<projectDir>/.claude/agents/*.md` (frontmatter `name`) |
| `cron` | 5-field cron, validated by croner |
| `timezone` | IANA, default machine local |
| `prompt` | string, required |
| `enabled` | bool |
| `maxRuntimeMinutes` | default 60 |
| `createdAt`, `updatedAt` | ISO |

**Run**
| field | notes |
|---|---|
| `id` | uuid |
| `scheduleId` | FK |
| `trigger` | `SCHEDULED` \| `MANUAL` |
| `status` | §3.2 |
| `skipReason` | when `SKIPPED` |
| `queuedAt`, `startedAt`, `endedAt` | ISO |
| `pid`, `exitCode`, `signal` | |
| `sessionId`, `model` | from `system/init` / `result` |
| `costUsd`, `durationMs`, `numTurns` | from `result` (cost is a client-side estimate) |
| `resultText` | the agent's final report |
| `permissionDenials` | JSON array from `result.permission_denials` |
| `toolCallCount`, `lastEventAt` | for the live view ("working vs stuck") |
| `eventLogPath`, `stderrLogPath` | files under the data dir |
| `settingsFileUsed` | path if §6 applied, else null |

**Setting** (key/value): `maxConcurrentRuns` (4), `schedulerEnabled` (true in
prod).

Retention: run rows kept indefinitely (small); `.jsonl`/stderr files pruned
after 30 days (a daily housekeeping job in the server).

## 5. API (all under `/api`, JSON, zod-validated both ways)

| Method + path | Purpose |
|---|---|
| `GET /health` | server up, `claude` version, scheduler on/off, data dir |
| `GET /status` | active runs, queue length, next 10 upcoming fires |
| `GET /agents?projectDir=` | discover agents in a project (`name`, `description`, `model`, has-settings-file) |
| `GET /schedules` · `POST /schedules` · `GET/PATCH/DELETE /schedules/:id` | CRUD; response includes `nextRuns[]` |
| `POST /schedules/:id/run` | Run now (subject to §2 #4 rules) |
| `GET /runs?scheduleId=&status=&limit=` | history |
| `GET /runs/:id` | summary |
| `GET /runs/:id/events?after=<seq>` | parsed events since a cursor (UI polls this for the live view) |
| `POST /runs/:id/stop` | SIGINT → grace → SIGTERM, `ABORTED` |
| `PATCH /settings` | concurrency cap, scheduler on/off |

**Local-only safety:** listen on `127.0.0.1` only; every mutating request must
carry header `X-Agent-Orchestrator: 1` (a cross-site page can't set a custom
header without a CORS preflight, which the server never approves). No CORS.

## 6. The one project-specific assumption (known debt)

If `<projectDir>/.claude/agent-settings/<agentName>.json` exists, the runner
passes it as `--settings`. This is nyc-311's convention for per-agent headless
allowlists (`CLAUDE.md` §9), baked in knowingly for now. It's the **only**
place the tool knows anything about a specific project. Revisit later — e.g. a
generic per-schedule "settings file" field, or moving allowlists somewhere
Claude Code loads natively. The run records `settingsFileUsed` so it's
visible, and the README must document the convention.

## 7. UI

Same layering as `web-app` (routes → hooks → services; components never call
services). Pages:

- **Dashboard** — header badge "**N runs active**" (visible on every page);
  active runs with elapsed time + last event; upcoming fires; recent
  non-`SUCCEEDED` runs.
- **Schedules** — list (agent, project, cron in words + next run, enabled
  toggle, last status), create/edit form with agent picker (from
  `GET /agents`), cron validation + preview of next 5 fires, **Run now**.
- **Run detail** — status, timings, cost; live event tail (tool name + short
  input, results collapsed) polling every 2 s while `RUNNING`; final report
  (markdown); **permission denials** with the rule text to add and a copy
  button; **Stop** button; links to the raw `.jsonl`/stderr.
- **Settings** — concurrency cap, scheduler on/off, data dir, `claude` version.

## 8. Package layout

One npm package, three source roots, mirroring `backend/` §5.2 and `web-app/`
§5.1 conventions:

```
agent-orchestration/
  CLAUDE.md             package rules (§10)
  README.md             setup for any project (§11)
  package.json
  shared/
    models/             zod schema + TS type per entity (Schedule, Run, RunEvent, AgentInfo, ...)
  server/
    main.ts             entry: config, DB migrate, scheduler + runner start, Fastify listen
    config.ts           env: port, host, data dir, dev flags
    logger.ts           structured JSON logging (same rules as backend/)
    controller/         Fastify route handlers — parse with zod, call services, log req/resp
    service/            scheduleService, runService, schedulerService, runnerService,
                        agentDiscoveryService, housekeepingService
    runner/             claudeCliRunner (real), fakeRunner (dev/test) — one Runner interface
    dao/                scheduleDao, runDao, settingDao over node:sqlite; migrations/
    models/errors.ts    typed errors → HTTP status in controllers
  web/
    config.ts  routes/  services/  hooks/  components/{pages}/  models → shared/
  tests/                mirrors server/, web/, shared/
  test-data/            fixtures + canned stream-json transcripts for fakeRunner
```

`dao/` never imported by `controller/` (same ESLint `no-restricted-imports`
rule as backend). DAOs constructed lazily per call (backend §5.2 lesson).

## 9. Run modes — dev never touches running agents

| Command | What | Effect on agents |
|---|---|---|
| `npm start` | built server + UI on `127.0.0.1:4311`, scheduler on, real `claude` runner, DB `orchestrator.db` | **the** live instance |
| `npm run dev:web` | Vite HMR on `:5173`, `/api` proxied to the running `:4311` | none — UI iteration against real data, server never restarts |
| `npm run dev` | watch-mode server on `:4312` + Vite, DB `orchestrator.dev.db` seeded from `test-data/`, **scheduler off**, **fakeRunner** (replays canned transcripts: tool calls, a denial, a result; configurable slow/timeout/fail) | none — separate process, port, DB, and no real `claude` |
| `npm run build` | `tsc -b` + `vite build` | none |

Shipping a change to the live instance: `npm run build`, then restart
`npm start` when the "N runs active" badge reads 0 (a restart `ABORTS` running
runs, by design). A "drain then restart" mode is a later nice-to-have.

`npm start` runs from a terminal the user leaves open — no launchd job for the
server (restart-on-reboot is a later consideration). A terminal-started
process can read `~/Documents`, so the launchd TCC issue from
`agent-automation-setup.md` doesn't apply.

## 10. `agent-orchestration/CLAUDE.md` (to be written first, before any code)

Per the user: loosely the same rules as the main project. It must define:

- **Structure** — §8 above, as the binding layout.
- **Conventions** — no `any`; zod at every boundary (HTTP in/out, SQLite rows,
  CLI stream events); one model per file; naming as `backend/`/`web-app/`
  (`camelCase.ts`, `PascalCase.tsx` components); ALL_CAPS enum values;
  block-comment format + 500-char cap (root §6.1, same `local/comment-format`
  ESLint rule); controller/service/dao layering; structured logging by layer.
- **Lint** — ESLint with `typescript-eslint`, `react-hooks`, `jsx-a11y`,
  `max-lines` 200 on `web/components/**`, `no-restricted-imports` for
  controller→dao, `no-explicit-any`.
- **Tests** — Vitest + `@vitest/coverage-v8`, RTL for components, Fastify
  `inject()` for controllers, a temp-dir SQLite per test, fakeRunner / a fake
  `claude` executable for runner tests. **90% per-file coverage gate**
  (lines/functions/branches/statements); `server/main.ts` excluded like `bin/`.
- **Build gates / Operational Loop** — `npm run build`, `npm run lint`,
  `npm run test:coverage` all green after the final change, per root §2.

Root `CLAUDE.md` updates in the same change: add `agent-orchestration/` to §1's
directory list (with its own CLAUDE.md as its structure section, lifting the
§1.1 lock for it), note §2's loop applies to it, and point §9 at this spec.

## 11. README requirement

`agent-orchestration/README.md` is a required deliverable of the first build,
written for **any project** that wants its agents scheduled — not just
nyc-311. It must cover:

1. Prerequisites — Node ≥ 26 (`node:sqlite`), Claude Code ≥ 2.1.259, logged
   in (`claude` once); `gh`/git auth only if your agents need them.
2. Install + run — `npm ci`, `npm run build`, `npm start`; the URL; data dir.
3. **Preparing a project** — agents in `.claude/agents/*.md`; permissions an
   unattended run needs must be pre-allowed by the project (headless runs
   deny anything else, via `--permission-prompts none`); the
   `.claude/agent-settings/<agent>.json` convention (§6); agents that edit
   code should isolate themselves (e.g. enter a worktree) since the tool runs
   them in the project directory as-is.
4. The exact command the tool runs (§3.1), so any schedule can be reproduced
   by hand.
5. Creating a schedule, Run now, reading a run (denials → how to fix).
6. Dev modes (§9) and how to ship changes to the live instance.
7. Where logs/DB live; how to reset; troubleshooting (claude not on PATH,
   agent not found, all tools denied, run stuck → Stop).

## 12. Migration from the launchd setup

**Prerequisite (option (a), agreed): devx-agent isolates itself.**
Because the tool runs agents in the real checkout, before its schedule is
enabled `devx-agent.md` must:

1. **Enter a worktree first** (`EnterWorktree`, under `.claude/worktrees/`),
   before any git or file operation.
2. **Own its mode logic** (§2 #3): count open `devx/` PRs; ≥ 3 → Revision
   mode, else the normal workflow. Remove the prompt dependence on
   `PROMPT_NEW`/`PROMPT_REVISE`.

Known issues to solve in that change (nyc-311-side, not tool-side):

- **Hooks read the wrong checkout.** After `EnterWorktree`,
  `${CLAUDE_PROJECT_DIR}` stays at the main checkout (documented). The guard
  (`devx-agent-guard.sh`) reads the branch there → sees `main` → would block
  every commit; `stamp-committer.sh` stamps the main checkout's git dir →
  commit prefix lost. Fix: both hooks use the hook input's `cwd` field
  (which follows the worktree) instead of `CLAUDE_PROJECT_DIR`.
- **Worktree setup.** A Claude-created worktree is a plain checkout: no
  `node_modules`, no `web-app/.env.local`. Options: `.worktreeinclude` for
  `.env.local` + the agent runs `npm ci` per package (simple, slower); or a
  project `WorktreeCreate`/`WorktreeRemove` hook doing today's APFS CoW clone
  (fast, more moving parts). Decide during that change.
- **Cleanup.** `-p` sessions don't remove their worktrees. The agent removes
  its own at the end (`ExitWorktree` with remove) when clean; stragglers are
  handled by Claude Code's periodic sweep or by hand.
- Add `.claude/worktrees/` to `.gitignore` (per the Claude Code worktree docs).
- Permission allowlist additions for the above (`EnterWorktree`, `npm ci`
  variants, etc.) in `.claude/agent-settings/devx-agent.json`.

**Cutover order** (no gap, no double-run):

1. Build the tool (§13).
2. Land the devx-agent prerequisite above; verify with a manual
   `claude -p --agent devx-agent …` run in the real checkout.
3. Create the devx schedule in the tool (06:00 + 18:00, prompt "Go"),
   **scheduler off**; one **Run now**; verify.
4. `scripts/agent-schedule-install.sh uninstall devx-agent`.
5. Scheduler on.
6. Follow-up commit: delete `scripts/agent-scheduled-run.sh`,
   `scripts/agent-schedule-install.sh`, `scripts/agent-schedules/`, the
   `~/agents/nyc-311` clone; replace `docs/agent-automation-setup.md` with a
   pointer to the README; update `CLAUDE.md` §9. `scripts/agent-worktree.sh`
   stays as a manual tool.

## 13. Build order

1. `agent-orchestration/CLAUDE.md` + root CLAUDE.md updates (§10) — review
   before code.
2. Package scaffold: `package.json`, TS configs, ESLint (incl.
   `local/comment-format`), Vitest with the 90% gate, Vite, Tailwind.
3. `shared/models` + SQLite DAOs + migrations.
4. Runner: `Runner` interface, `claudeCliRunner`, `fakeRunner`, stream
   parsing, timeout/stop/abort, concurrency queue, skip rule.
5. Scheduler service (croner) + agent discovery.
6. Controllers/API + local-only guard.
7. UI: Schedules → Run detail (live) → Dashboard → Settings.
8. Dev modes (§9) + README (§11).
9. Operational Loop green; then migration (§12).

## 14. Risks and open items

- **`CLAUDE_PROJECT_DIR` vs worktrees** for nyc-311's hooks (§12) — must be
  verified in the devx prerequisite change.
- **Stream-json schema drift** — lenient parsing (§3.3); pin a minimum CLI
  version in `/health`.
- **Terminal-hosted server** — closing the terminal or rebooting stops
  scheduling (accepted for now; a launchd/login item for `npm start` can come
  later).
- **Subscription usage** — many schedules share one subscription's limits;
  `api_retry` events with `rate_limit` are surfaced in the run view.
- **Cost figures** are client-side estimates (per the CLI docs).
- **§6 debt** — the one nyc-311 convention in the tool.
