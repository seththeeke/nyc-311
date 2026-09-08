# Parallel agent runs — worktree isolation plan

> **Built + generalized 2026-09-08.** First cut targeted `devx-agent`; it is
> now a **generic primitive** (`scripts/agent-worktree.sh`) usable by any agent
> — the isolation and the per-worktree committer stamp don't care which agent
> (or the main session) is running. `CLAUDE.md` §9 is the canonical pointer.
> Sections below that still say "devx-agent" describe the first use case, not a
> constraint.

## Context

`devx-agent` (`.claude/agents/devx-agent.md`) was the first agent built to run
autonomously, and the goal was to run **10–15 of them concurrently** on this
machine, each landing one scoped change as a branch + PR. The same collisions
hit **any** agent (or the main session) run in parallel against this repo —
every `claude` process shares the single working tree at
`/Users/seththeeke/Documents/projects/nyc-311`:

- **Git index / HEAD** — `git checkout -b`, `git add -A`, `git commit`, and
  `git checkout main && git pull` (devx-agent workflow steps 4 and 7) all mutate
  one shared tree and index. Two agents running these at once corrupt each
  other's staged state and can commit a half-written change.
- **Committer stamp** — `.claude/hooks/stamp-committer.sh` writes a single
  `CLAUDE_COMMITTER` file that `.githooks/prepare-commit-msg` reads and then
  deletes. Concurrent commits race on it: an agent picks up the wrong agent
  name, or the file is already gone and the commit gets no prefix.
- **Build artifacts and ports** — `cdk.out/`, `coverage/`, Vitest temp output,
  and any dev-server port are shared and clobber across runs.

**Chosen approach (confirmed with the user):** a single primitive,
`scripts/agent-worktree.sh`, that gives any `claude --agent <name> -p "…"` run
its own **git worktree**, with `node_modules` populated by **APFS copy-on-write
clone** (`cp -c`) from the primary checkout. **Primitives only** — no fleet
orchestrator in this pass; the user drives parallelism.

A git worktree shares one `.git` object store and ref namespace but has its own
working tree, index, and HEAD — precisely the isolation needed. Two constraints
follow and are handled below:

1. A branch can be checked out in **at most one worktree**, so the agent can no
   longer run `git checkout main` — it must branch directly off `origin/main`.
2. The committer stamp must be **per-worktree** or concurrent commits race on
   one file. It moves from `git rev-parse --git-path CLAUDE_COMMITTER`
   (whose resolution for a non-standard file name has varied across git
   versions) to `$(git rev-parse --git-dir)/CLAUDE_COMMITTER` — reliably
   per-worktree on every version. Applies to any agent, not just devx-agent.

## Approach

### 1. `scripts/agent-worktree.sh` — the isolation primitive (new file)

One POSIX-sh script, `chmod +x`, three subcommands. Worktrees live in a sibling
directory `<repo-basename>-worktrees/<name>` (i.e. `../nyc-311-worktrees/`;
override with `AGENT_WORKTREE_ROOT`) — outside the repo, so no tool/glob
recursion or nested-repo edge cases.

- **`new [name]`** — `name` defaults to `wt-<epoch>-<rand4>`. Not agent-scoped;
  pass a name if you want the agent visible in `ls`.
  1. `mkdir -p "$AGENT_WORKTREE_ROOT"`.
  2. `git -C <primary> fetch origin main`, serialized against overlapping `new`
     calls by an **atomic `mkdir` lock** (`flock` in the original plan — macOS
     ships none), with one `fetch` retry.
  3. `git -C <primary> worktree add --detach "<root>/<name>" origin/main` —
     detached HEAD at the latest `origin/main`; the agent creates its own
     `devx/<issue>-<slug>` branch inside (workflow step 4).
  4. CoW-clone deps: for each of `.`, `web-app`, `backend`, `cdk` that has a
     `node_modules`, `cp -c -R <primary>/<pkg>/node_modules
     <worktree>/<pkg>/node_modules`. `cp -c` fails loudly off APFS — acceptable
     on this machine. Writes in the worktree (e.g. a dependency-upgrade run's
     `npm install`) never touch the primary's modules — CoW blocks diverge on
     write.
  5. Copy gitignored-but-required files the checkout won't contain:
     `.claude/settings.local.json` (the permission allowlist — without it a
     headless `-p` run prompts on nearly every tool call) and
     `web-app/.env.local`. The list lives in a `COPY_UNTRACKED=( … )` array at
     the top of the script. Root `.env` is personal notes only — not copied.
  6. Print the absolute worktree path as the last line of stdout, so a caller
     can `cd "$(scripts/agent-worktree.sh new)"`.
- **`rm <name|path>`** — `git -C <primary> worktree remove --force <path>` then
  `git -C <primary> worktree prune`. The branch is left intact (the PR needs
  it). Refuses any path not under `AGENT_WORKTREE_ROOT`.
- **`ls`** — `git worktree list` filtered to the worktree root, with each
  one's current branch and its `git status --porcelain` line count.

### 2. `.claude/hooks/stamp-committer.sh` — per-worktree stamp (edit)

Replace the stamp-path resolution (currently
`git … rev-parse --git-path CLAUDE_COMMITTER`, ~line 28) with the **per-worktree**
git dir:

```sh
git_dir=$(git -C "$project_dir" rev-parse --git-dir 2>/dev/null)
[ -z "$git_dir" ] && exit 0
case "$git_dir" in /*) : ;; *) git_dir="$project_dir/$git_dir" ;; esac
stamp_path="$git_dir/CLAUDE_COMMITTER"
```

In the primary checkout `--git-dir` is `.git` (behaviour unchanged); in a
worktree it is `.git/worktrees/<name>`, so each concurrent commit stamps its own
file. Update the file header comment to say the stamp is per-worktree.

### 3. `.githooks/prepare-commit-msg` — read the same per-worktree path (edit)

Line 27 currently `git rev-parse --git-path CLAUDE_COMMITTER`. This hook runs
with `cwd` = the worktree, so:

```sh
stamp_path="$(git rev-parse --git-dir 2>/dev/null)/CLAUDE_COMMITTER"
```

Verified on implementation: single-worktree commit and two worktrees committing
in the same second each got their correct, distinct agent prefix
(`devx-agent` / `claude-default-agent` / an arbitrary `some-other-agent`).

### 4. `.claude/agents/devx-agent.md` — worktree-safe workflow (edit)

- **Step 4 (Branch)** — replace
  `git checkout main && git pull --ff-only origin main` with:
  ```
  git fetch origin
  git checkout -b devx/<issue-number>-<short-slug> origin/main
  ```
  Add: *"You may be running in a git worktree; never `git checkout main` (it is
  checked out elsewhere) — always branch straight off `origin/main`."*
- Note in **§Absolute rules / step 1** that the guard hook and committer stamp
  both work unchanged in a worktree (the guard reads `git branch --show-current`
  in `CLAUDE_PROJECT_DIR`, which is the worktree).
- **New section `## Running in parallel (worktrees)`** — ~5 lines: each
  autonomous run gets its own worktree via `scripts/agent-worktree.sh new`;
  launch with `claude --agent devx-agent -p "…"` from inside it; tear down with
  `scripts/agent-worktree.sh rm <name>` once the PR is open (branch + PR survive
  teardown). Note that parallel runs each appending to
  `docs/99-things-to-come-back-to.md` on separate branches can conflict at merge
  time — a human-merge concern, acceptable.

### 5. `CLAUDE.md` — the canonical pointer (edit)

New **§9 "Parallel Agent Runs (worktree isolation)"** — the generic contract for
running *any* agent (or the main session) in a worktree: the
`scripts/agent-worktree.sh` subcommands, the per-worktree committer stamp (no
per-agent config), the "never `git checkout main` in a worktree — branch off
`origin/main`" rule that every agent doc with a git workflow points at, and the
note that a must-not-touch-`main` agent wires its own guard hook
(`devx-agent-guard.sh` as the example). Points at this doc for rationale.

## Out of scope

- No fleet runner / concurrency cap (user chose primitives only).
- No `docs/99-things-to-come-back-to.md` conflict handling beyond the note above.
- No shared-`node_modules` optimisation beyond CoW; no pnpm-store migration.
- `scripts/` is an established repo-root directory (`rollup-coverage.js`,
  `publish-coverage.js`) and is **not** one of CLAUDE.md §1.1's locked dirs, so
  adding `agent-worktree.sh` needs no lock lift. No file under `web-app/`,
  `backend/`, or `cdk/` is touched.

## Critical files

| File | Change |
|---|---|
| `scripts/agent-worktree.sh` | **new** — `new` / `rm` / `ls` primitive |
| `.claude/hooks/stamp-committer.sh` | stamp path → per-worktree `--git-dir` |
| `.githooks/prepare-commit-msg` | read stamp from per-worktree `--git-dir` |
| `.claude/agents/devx-agent.md` | step 4 branch-from-`origin/main`; parallel section points at §9 |
| `CLAUDE.md` | §9 — the canonical, agent-agnostic contract |

Because nothing under `web-app/`, `backend/`, or `cdk/` changes, CLAUDE.md §2's
Operational Loop (build/lint/test/coverage) has nothing to run here — this is
shell tooling, git hooks, and docs only.

## Verification

**Status:** 1, 2, 4 (guard reads the worktree branch), 5 done on
implementation. 3 (a live `claude --agent … -p` run from a worktree) needs a
real agent run — not done from the implementing session.

1. **Single worktree, end to end**
   - `scripts/agent-worktree.sh new smoke` prints `.../nyc-311-worktrees/smoke`.
   - `<wt>/web-app/node_modules` etc. exist; `du -sh` confirms the CoW clone
     added near-zero disk; `.claude/settings.local.json` and
     `web-app/.env.local` are present.
   - In the worktree: `git status` clean; `git rev-parse --git-dir` →
     `.git/worktrees/smoke`.
   - Trivial edit → `git checkout -b devx/999-smoke origin/main` →
     `git commit -am "[feat] - smoke"` yields
     `[feat] - claude-default-agent: smoke`. Primary `git log` / `git status`
     untouched.
   - `scripts/agent-worktree.sh rm smoke` removes the worktree; `devx/999-smoke`
     branch still present (delete by hand afterward).
2. **Two worktrees, concurrent commits** — create `a` and `b`, commit in both
   within the same second from two shells; each commit gets the correct agent
   prefix and neither loses its stamp.
3. **Real agent run** — `cd` into a fresh worktree, run
   `claude --agent devx-agent -p "find one measurable repo-health win"`; confirm
   it branches off `origin/main` (no guard block), lands a branch + PR, and the
   primary checkout never moves.
4. **Guard still bites** — in a worktree, `git checkout main` then `git commit`
   is blocked; `git push origin main` is blocked.
5. `scripts/agent-worktree.sh ls` shows clean state after `rm` + `prune`.
