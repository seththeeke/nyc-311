# 19 · Agent efficiency: devx-agent and aws-cost-agent

Status: **proposal, nothing built yet** (2026-11-08). Paused while Seth
restarts his machine; pick up from *Open questions*.

Goal: make the two most valuable agents, Pip (`devx-agent`) and Grimble
(`aws-cost-agent`), cheaper and faster per run **without lowering their
cadence**.

Source: Penny's usage report,
`agent-reports/2026-11-08/08_34/chief-of-staff-agent-usage.md` (last 24 h).

## 1. Findings

| Agent | Runs | Fresh | Output | Cache reads | Model |
|---|---|---|---|---|---|
| devx-agent | 5 | 610.4k | 110.0k | 18.14M | opus-5-5 |
| aws-cost-agent | 2 | 512.2k | 139.2k | 25.92M | sonnet-5 |

Grimble's two runs made 100 and 119 API calls: 25.92M cache reads across
~219 calls is an average context of **~118k tokens per call**.

### 1.1 The model is not the main cost driver

- Grimble already runs on Sonnet (`MODEL=sonnet` in
  `scripts/agent-schedules/aws-cost-agent.env`) and still produced the two
  heaviest runs of the day.
- Token volume is **calls × context size**. Every call re-reads everything
  already in the context, so large tool outputs early in a run are paid for
  again on every later call.
- devx-agent has no `MODEL` line, so it runs on the default (Opus 5.5).
  Moving it to Sonnet reduces the *cost per token* against usage limits; it
  does not much reduce the *number* of tokens, and may add a few calls.

### 1.2 Likely sources of bloat (from reading the agent definitions)

These are hypotheses, not yet confirmed: the run transcripts live on the Mac
mini (`~/.claude/projects/*-worktrees-<agent>-*`), not on the laptop.

**devx-agent** (`.claude/agents/devx-agent.md`)
- Re-surveys the repo from scratch on all 8 daily runs, with no memory.
- Step 1 suggests `npx vitest run --reporter=verbose`: one line per test
  (~1,577 backend, ~1,545 web-app).
- A failed pipeline pulls `logs get-log-events --limit 10000`, a whole
  CodeBuild log, into context.
- Fixed per-run GitHub/AWS calls: pipeline check, `gh pr list` for `devx/`
  PRs, the backlog request query, `gh pr view` and `gh api …/comments` per PR.
- Full Operational Loop output (build, lint, `test:coverage`) goes straight
  into context.

**aws-cost-agent** (`.claude/agents/aws-cost-agent.md`)
- Raw Cost Explorer JSON: daily-by-service grows with the month, and each
  `USAGE_TYPE`/`RESOURCE` drill-down adds more.
- `describe-*`/`list-*` calls to map cost lines to resources, then reading the
  CDK that creates them.
- On a landed change: `npx cdk synth` without `-q` likely prints the full
  template, plus cdk's 449-test coverage run.
- Tending PRs: `gh api …/pulls/<n>/comments --paginate` raw JSON.
- Wall time ≈ ~110 calls at ~118k context, plus minutes of cdk test/synth.

Side note: Grimble is scheduled once a day (03:30 Pacific) but ran twice in
the window (03:35 and 14:21 UTC), neither matching the slot. Likely manual
runs, which alone account for a large share of its total.

## 2. Proposal, in order

1. **Profile first: `scripts/agent-run-profile.sh <agent> [hours]`.** Reads
   the same transcripts as `scripts/agent-usage-summary.sh`. Per run: wall
   time, call count, and the top 15 tool results by size, with the command
   behind each. Run on the Mac mini to confirm or correct §1.2 before
   building anything else.
2. **`MODEL=sonnet` in `scripts/agent-schedules/devx-agent.env`.** One line,
   already supported by `agent-scheduled-run.sh`. Watch Rex's approve/block
   rate on `devx/` PRs for a week. Haiku is too weak for code changes under a
   90% per-file coverage gate.
3. **Preflight scripts, run by the scheduler and appended to the prompt**,
   the same pattern as `USAGE_SUMMARY=1` for Penny. Gathering costs zero
   tokens; the agent starts with a compact summary.
   - `scripts/cost-snapshot.sh` (Grimble): MTD by service, forecast, 7-day
     vs prior 7-day $/day per service, top usage types for the top 3
     services. Prints a compact markdown table; saves raw JSON to a file the
     agent opens only if needed. Uses ~5 of the 8 Cost Explorer calls,
     leaving ~3 for drill-downs.
   - `scripts/devx-preflight.sh` (Pip): pipeline status (on failure, only the
     failing action and its error lines), filtered backlog requests, and a
     health snapshot: slowest test files and files nearest the 90% gate
     (from each package's `coverage-summary.json`), plus `npm outdated` /
     `npm audit` counts.
   - `scripts/agent-pr-status.sh <prefix>` (shared, maybe Rex too): open PRs
     with mergeable state, Rex's marks, and unaddressed review comments.
4. **Output discipline in both agent definitions.** Send build/test/synth
   output to a file and read only the tail or failures; `cdk synth -q`; drop
   `--reporter=verbose`.
5. **Optional: memory for devx-agent (`MEMORY=1`)**, so it remembers what it
   already surveyed or declined instead of re-doing that work 8 times a day.

## 3. Open questions

1. **Go ahead with steps 1 and 2 now** (profiler + Sonnet for devx-agent),
   and build step 3 from what the profile shows?
2. **Sonnet for all devx-agent runs**, or split by mode with
   `MODEL_NEW` / `MODEL_REVISE` (e.g. Sonnet for REVISE, Opus for NEW)?
3. **Preflight data in the prompt or in a file?** Appending to the prompt is
   simplest; a file in the run folder keeps prompts short and lets the agent
   read only what it needs.
4. **devx-preflight's health snapshot needs test/coverage runs**, which take
   minutes. Run them in the scheduler before every run, once a day and
   cached, or skip and read only existing `coverage-summary.json` files?
5. **Were Grimble's two runs on Nov 7–8 manual?** If so, the daily cost is
   about half what the report suggests.
6. **Should Rex (cto-agent) also use `agent-pr-status.sh`?** He had 8 runs
   and 487.8k fresh tokens; the same PR-status gathering applies.
7. **Give devx-agent memory (step 5)**, or keep it stateless?
