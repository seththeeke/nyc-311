# Agent automation — scheduled autonomous runs

How the repo's autonomous agents (today: `devx-agent`) run unattended on a
cadence, on the dedicated Mac mini. Builds on the worktree isolation in
`autonomous-agent-plan.md` / `CLAUDE.md` §9.

**Design rule: the machine holds as little as possible.** The only per-machine
artifact is a barebones launchd plist (two times of day + one command). All
logic — mode selection, PR limit, logging, cleanup, prompts, permissions —
lives in this repo and changes through normal commits.

## How a run works

```
launchd (06:00, 18:00)
  └─ scripts/agent-scheduled-run.sh devx-agent
       1. fast-forward the primary checkout (only if on a clean main);
          `npm ci` any package whose lockfile changed; re-exec if this script changed
          then read config + prompts from a fresh origin/main (always latest)
       2. count open PRs on devx/* branches
            < 3  → NEW mode     find + land one improvement (issue + PR)
            ≥ 3  → REVISE mode  address unaddressed review comments on those PRs
       3. scripts/agent-worktree.sh run devx-agent "<mode prompt>"
            └─ isolated worktree off origin/main → claude --agent devx-agent -p …
       4. comment a summary on the pinned "devx-agent run log" issue
       5. prune host logs > 30 days, kept worktrees > 7 days
```

| Piece | Where |
|---|---|
| Schedule, PR limit, branch prefix, mode prompts | `scripts/agent-schedules/<agent>.env` |
| Scheduled-run logic | `scripts/agent-scheduled-run.sh` |
| launchd install / uninstall / status / kick | `scripts/agent-schedule-install.sh` |
| Worktree isolation | `scripts/agent-worktree.sh` (`CLAUDE.md` §9) |
| What the agent may do (complete allowlist + denies) | `.claude/agent-settings/<agent>.json` |
| Agent behaviour, incl. *Revision mode* | `.claude/agents/<agent>.md` |

### Seeing what happened

- **GitHub (everyone):** each agent has one pinned issue, `<agent> run log`
  (label `agent-run-log`), with one comment per run — time, mode, exit
  status, duration, open PRs before/after, and the agent's final report.
  Failed runs post there too; that issue *is* the alerting. The real output is
  the PRs, issues, and review replies themselves.
- **The Mac mini:** full logs in
  `~/Library/Logs/nyc311-agents/<agent>/<timestamp>.log` (+ `.report.md`), and
  `launchd.log` for anything that failed before logging started. Logs are
  intentionally **not** committed — they can capture command output (env
  values, tokens), and committing them would mean a commit to `main` per run.
- A run that exits non-zero or leaves uncommitted changes keeps its worktree
  under `~/agents/nyc-311-worktrees/` for inspection (`scripts/agent-worktree.sh ls`);
  it's auto-removed after 7 days.

### Revision mode and the comment marker

The agent's `gh` credentials are the repo owner's, so GitHub authorship can't
separate the agent's comments from a human's. Every agent PR comment begins
with `<!-- devx-agent -->`; any unmarked comment newer than the agent's latest
marked one is "unaddressed". Revisions are new commits on the PR branch — never
rebase/force-push; merge conflicts are left for the human.

## One-time machine setup

On a fresh machine. **The scheduler uses its own clone, outside
`~/Documents` / `~/Desktop` / `~/Downloads`.** macOS privacy protection (TCC)
blocks launchd jobs from reading those folders (`/bin/sh: …: Operation not
permitted` in `launchd.log`), and a dedicated clone also keeps your dev
checkout from ever being auto-pulled. Convention: `~/agents/nyc-311`
(worktrees land in `~/agents/nyc-311-worktrees/`).

```
mkdir -p ~/agents && git clone https://github.com/seththeeke/nyc-311 ~/agents/nyc-311
cd ~/agents/nyc-311
```

Then, from that clone:

1. **Tools:** `brew install gh node` (Claude Code: `brew install claude` or the
   official installer). `aws` CLI is optional — agents don't mutate AWS.
2. **GitHub auth** (the bot acts as the repo owner):
   ```
   gh auth login        # GitHub.com, HTTPS, browser login
   gh auth setup-git    # git push over HTTPS uses gh's token
   git config --global user.name "<name>"
   git config --global user.email "<email>"
   ```
3. **Claude auth:** run `claude` once and log in. Credentials go in the login
   keychain, which launchd jobs can read while you're logged in.
4. **Dependencies:** `npm ci` in `.`, `web-app/`, `backend/`, `cdk/` — worktrees
   CoW-clone these. (Newer npm blocks `esbuild`/`fsevents` install scripts by
   default; builds and tests pass without them.)
5. **Keep the machine up:**
   ```
   sudo pmset -a sleep 0 disksleep 0 autorestart 1
   ```
   and enable automatic login (System Settings → Users & Groups; requires
   FileVault off). launchd *user* agents only run inside a logged-in session;
   without auto-login, a power loss stops runs until someone logs in.
6. **Install the schedule:**
   ```
   scripts/agent-schedule-install.sh install devx-agent
   scripts/agent-schedule-install.sh status devx-agent
   scripts/agent-schedule-install.sh kick devx-agent     # optional: run now
   ```
   To force a mode by hand:
   `AGENT_MAX_OPEN_PRS=0 scripts/agent-scheduled-run.sh devx-agent` (REVISE)
   or `=99` (NEW).

Don't develop in `~/agents/nyc-311` — it must stay on a clean `main` for each
run to fast-forward it (otherwise the run logs a warning and continues).

### Always the latest prompt

Prompt/agent changes need no machine-side step — merge to `main` and the next
run picks them up: the worktree (so `.claude/agents/<agent>.md` and
`.claude/agent-settings/<agent>.json`) is created from a just-fetched
`origin/main`, and the wrapper reads `scripts/agent-schedules/<agent>.env`
from `origin/main` too. Only the wrapper script itself relies on the
primary checkout fast-forwarding.

## Adding another agent

1. `.claude/agents/<agent>.md` — the agent, with a git workflow that branches
   off `origin/main` (`CLAUDE.md` §9) and a revision mode if it opens PRs.
2. `.claude/agent-settings/<agent>.json` — its complete permission allowlist
   (a headless run silently denies anything not listed).
3. `scripts/agent-schedules/<agent>.env` — `SCHEDULE`, `BRANCH_PREFIX`,
   `MAX_OPEN_PRS`, `PROMPT_NEW`, `PROMPT_REVISE`.
4. On the Mac mini: `scripts/agent-schedule-install.sh install <agent>`.

Changing an existing agent's schedule: edit `SCHEDULE`, merge, then re-run
`install` on the machine (the only change that needs a machine-side step).
