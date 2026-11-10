# Agent automation — scheduled autonomous runs

> **Monitoring:** `agent-web-app/` (its `SPEC.md`) is a localhost, read-only
> view of everything below. It may take over scheduling in a later phase;
> until then this launchd setup is the scheduler.

How the repo's autonomous agents (`devx-agent`, `gen-purpose-dev` and the rest of the team)
run unattended on a cadence, on the dedicated Mac mini. Builds on the worktree isolation in
`autonomous-agent-plan.md` / `CLAUDE.md` §9.

**Design rule: the machine holds as little as possible.** The only per-machine
artifact is a barebones launchd plist (two times of day + one command). All
logic — mode selection, PR limit, logging, cleanup, prompts, permissions —
lives in this repo and changes through normal commits.

## How a run works

`devx-agent` — finds its own work (schedule `KIND` `pr-limit`, the default):

```
launchd (06:00, 18:00)
  └─ scripts/agent-scheduled-run.sh devx-agent
       1. fast-forward the primary checkout (only if on a clean main);
          `npm ci` any package whose lockfile changed; re-exec if this script changed
          then read config + prompts from a fresh origin/main (always latest)
       2. count open PRs on devx/* branches
            < 3  → NEW mode     tend open PRs first, then land one improvement
                                (a backlog issue requesting devx-agent wins over
                                self-found work; issue + PR)
            ≥ 3  → REVISE mode  tend open PRs only (comments + merge conflicts)
       3. scripts/agent-worktree.sh run devx-agent "<mode prompt>"
            └─ isolated worktree off origin/main → claude --agent devx-agent -p …
       4. prune host logs > 30 days, kept worktrees > 7 days
```

`gen-purpose-dev` (Kid Kestrel) — works the cards on the Kid Kestral project
board (`KIND="board"`, `docs/17-executive-team.md` §22):

```
launchd (4 a day, Opus 5.5)
  └─ scripts/agent-scheduled-run.sh gen-purpose-dev
       1. as above
       2. list its cards with scripts/agent-board.sh; K1 (BUILD=0):
            SPEC    each card in Assigned that isn't parked, oldest first,
                    at most MAX_CARDS_PER_RUN
            IDLE    nothing to do → stop here; `claude` is never started
       3. per card, its own session and worktree:
          scripts/agent-worktree.sh run gen-purpose-dev "<PROMPT_SPEC> Your card: #<n>"
          afterwards: card still in Assigned and not parked → a parked comment
       4. as above
```

| Piece | Where |
|---|---|
| Schedule, kind, PR limit, branch prefix, mode prompts | `scripts/agent-schedules/<agent>.env` |
| Scheduled-run logic | `scripts/agent-scheduled-run.sh` |
| Project board reads and moves, per agent (board agents, Celestine, Rex) | `scripts/agent-board.sh` |
| A spec straight to `main` (`gen-purpose-dev`) | `scripts/agent-spec-commit.sh` |
| Per-agent `main`/merge/deploy guard hook | `.claude/hooks/<agent>-guard.sh` |
| launchd install / uninstall / status / kick (one agent) | `scripts/agent-schedule-install.sh` |
| Start / stop / restart the whole team, latest code checked first | `scripts/agent-team.sh` |
| Worktree isolation | `scripts/agent-worktree.sh` (`CLAUDE.md` §9) |
| What the agent may do (complete allowlist + denies) | `.claude/agent-settings/<agent>.json` |
| Agent behaviour, incl. *Revision mode* | `.claude/agents/<agent>.md` |

### Starting, stopping and restarting the team

`scripts/agent-team.sh {start|stop|restart|status|check|list} [agent ...]` acts on
every scheduled agent, Kid Kestrel (`gen-purpose-dev`) included,
or only the agents named. It always works on the scheduler clone
`~/agents/nyc-311`, whichever checkout it's run from.

- `start` first checks the clone is a clean `main` at the latest
  `origin/main`, fast-forwarding it (and running `npm ci` where a lockfile
  changed) or refusing if it can't, then installs each schedule.
- `stop` unloads each schedule and kills any run in progress.
- `restart` runs the check, then stop, then start. `status`, `check` and
  `list` change nothing.
- With no agent named, `start` and `restart` also install the
  **schedule-sync** job, and `stop` removes it (below).

### Schedule changes apply themselves

`scripts/agent-schedule-sync.sh` runs from launchd every 15 minutes as its own
job (`com.nyc311.schedule-sync`); it never starts `claude`. Each time, it
brings the scheduler clone to `origin/main` (the same check as `start`), then:

- reinstalls any team agent whose installed plist differs from what
  `agent-schedule-install.sh render <agent>` gives: a merged `SCHEDULE`
  change, or a new agent;
- leaves alone an agent whose plist exists but isn't loaded (stopped by hand
  with `agent-team.sh stop <agent>`);
- defers an agent whose run is in progress to the next sync, since reloading
  a launchd job kills its running process;
- uninstalls an agent whose schedule file is gone from `main`.

It logs only what it changes, and failures, to
`~/Library/Logs/nyc311-agents/schedule-sync/sync.log`. Everything else an
agent reads (prompt, settings, the rest of its `.env`) already comes from
`origin/main` on each run, so **merging is the whole job**: a schedule change
reaches the Mac mini within 15 minutes. `agent-team.sh status` shows the job's
state; `agent-schedule-sync.sh run` syncs now.

### Seeing what happened

- **GitHub:** only the agent's real work — backlog tickets (closed with
  findings if the idea didn't pan out), PRs, and review replies. The wrapper
  posts nothing to GitHub itself; run logs are deliberately kept off GitHub.
- **The Mac mini (per-run logs live only here):**
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
marked one is "unaddressed". Every run (NEW or REVISE) tends open `devx/` PRs
before new work. Revisions are new commits on the PR branch — never
rebase/force-push; merge conflicts are resolved by merging `origin/main` into
the branch, or left for the human (with an explanation) if intent is ambiguous.

The same marker identifies requests: a backlog-issue comment mentioning
`devx-agent` without the marker asks the agent to pick that issue up, and NEW
mode prioritizes it over self-found work.

## gen-purpose-dev — the project board

`gen-purpose-dev` (`.claude/agents/gen-purpose-dev.md`) is Kid Kestrel, the
Software Engineer. He works projects from the **Kid Kestral** project board
([projects/3](https://github.com/users/seththeeke/projects/3)); the board, not
labels, is his state. The full design is `docs/17-executive-team.md` §22.

**To assign a card, move it from Refined to Assigned** on the board. Celestine
files tickets to Intake; Celestine and Rex approve them into Refined.

**In K1 he writes specs only** (`BUILD=0`): for each Assigned card he measures
the ticket's success metric, writes `docs/kid-kestral/<n>-<slug>.md`, commits
it to `main` with `scripts/agent-spec-commit.sh`, links it on the ticket and
moves the card to Spec Created. A ticket he can't ship behind a flag, or
measure, goes back to Intake with a proposed split.

**Parking.** When he needs an answer he posts a comment starting
`<!-- gen-purpose-dev:parked -->` and leaves the card where it is; the
scheduler skips it until someone else comments. **Reply on the issue to
resume it.** A session that dies with its card still in Assigned is parked
the same way (fail closed).

### Safety rails

| Rail | Where | What it stops |
|---|---|---|
| Agent rules | `.claude/agents/gen-purpose-dev.md` *Absolute rules* | other cards, unflagged work, `main` beyond his spec, merging/closing, infra and flag changes |
| Board script | `scripts/agent-board.sh` | any move outside his row (Assigned → Spec Created, back to Intake); Spec Created without the spec on `main` |
| Spec commit | `scripts/agent-spec-commit.sh` | anything but one `docs/kid-kestral/<issue>-<slug>.md` reaching `main` |
| Allowlist + denies | `.claude/agent-settings/gen-purpose-dev.json` | everything not listed; raw `gh project`, `agent-commit-to-main.sh`, merge/close, force-push, deploy, the admin AWS profile, other agents' MCP servers |
| Guard hook | `.claude/hooks/gen-purpose-dev-guard.sh` | commit on / push to `main`, force-push, `reset --hard`, merge/close, non-draft PRs, deploy, raw `gh project` / `gh api graphql`, `agent-commit-to-main.sh`; fails closed |
| Worktree | `scripts/agent-worktree.sh` | touching your checkout, another run's, or another card's |
| Wrapper | `scripts/agent-scheduled-run.sh` | two runs at once (lock), a dead session silently retrying (parks its card) |

### AWS access — one role per agent

Each agent that needs AWS gets its own IAM user, holding its own access key, and its own role, which only that user can assume. No agent uses a human admin credential. A leaked or misused key reaches only that agent, and one agent can be disabled or rotated without touching the others. Users and roles are defined in CDK under `cdk/agents/`, deployed with `Nyc311PipelineStack`.

| Piece | What it is |
|---|---|
| `devx-agent` (user) | `devx-agent`'s IAM user. It holds no permissions beyond assuming `Nyc311DevxAgentRole`. Its access key is created by hand, never in CDK. |
| `Nyc311DevxAgentRole` | `devx-agent`'s role: AWS `ReadOnlyAccess` for Test and Prod (one account), with Secrets Manager values, SSM parameters and KMS decrypts denied. Assumable only by the `devx-agent` user with source identity `devx-agent`, so CloudTrail attributes every call. One-hour sessions. |

`gen-purpose-dev` (Kid Kestrel) has user `gen-purpose-dev` and `Nyc311EngineerAgentRole`, read-only like `devx-agent`'s, through profile `nyc311-gen-purpose-dev`. `coo-agent` needs no AWS role: everything it does goes through Cognito.

Team Chat needs no AWS credentials either. The sign-in reads the agent client ids from `scripts/agent-schedules/team-chat.env`.

**Setup on the Mac mini, after the pipeline deploys `cdk/agents/`:**

1. **Access key.** In the IAM console, open Users → `devx-agent` → Security credentials → Create access key. Put it in the mini's `~/.aws/credentials`:
   ```
   [devx-agent-key]
   aws_access_key_id = …
   aws_secret_access_key = …
   ```
2. **Credential script.** The CLI can't stamp a source identity from a plain `role_arn` profile. Save this as `~/.aws/nyc311-agent-credentials.sh` and `chmod 700` it:
   ```sh
   #!/bin/sh
   # usage: nyc311-agent-credentials.sh <role-name> <agent-name>   (the key profile is <agent-name>-key)
   exec aws --profile "$2-key" sts assume-role \
     --role-arn "arn:aws:iam::178280182163:role/$1" \
     --role-session-name "$2" --source-identity "$2" --duration-seconds 3600 \
     --query '{Version:`1`,AccessKeyId:Credentials.AccessKeyId,SecretAccessKey:Credentials.SecretAccessKey,SessionToken:Credentials.SessionToken,Expiration:Credentials.Expiration}' \
     --output json
   ```
3. **Profile.** Add to `~/.aws/config`:
   ```
   [profile nyc311-devx-agent]
   region = us-east-1
   credential_process = /Users/<you>/.aws/nyc311-agent-credentials.sh Nyc311DevxAgentRole devx-agent
   ```
4. **Verify.** A read works, a write is refused, and the call is attributed:
   ```
   aws --profile nyc311-devx-agent sts get-caller-identity    # …assumed-role/Nyc311DevxAgentRole/devx-agent
   aws --profile nyc311-devx-agent codepipeline list-pipeline-executions --pipeline-name Nyc311Pipeline --max-items 1
   aws --profile nyc311-devx-agent sqs purge-queue --queue-url <any queue url>   # must fail: AccessDenied
   ```
5. **Remove the admin profile** (`nyc311`) from the mini. `devx-agent.json` and `devx-agent-guard.sh` already deny it.

A future agent repeats these steps with its own user, key profile (`<agent>-key`), role and `nyc311-<agent>` profile.

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
4. **Dependencies:** `npm ci` in `.`, `web-app/`, `backend/`, `cdk/`,
   `customer/backend/`, `agent-web-app/` — worktrees CoW-clone these, and
   the scheduler and `agent-team.sh start` re-run `npm ci` in any of them
   left without `node_modules`. (Newer npm blocks
   `esbuild`/`fsevents` install scripts by
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
   scripts/agent-schedule-install.sh install gen-purpose-dev
   ```
   `gen-purpose-dev`'s wrapper also needs `jq` (`brew install jq` — the
   committer-stamp hook already requires it) and `gh` with the `project`
   scope (`gh auth refresh -h github.com -s project`).
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
   `MAX_OPEN_PRS`, `PROMPT_NEW`, `PROMPT_REVISE`; an operating agent sets
   `KIND="operations"`, and a board agent `KIND="board"` with `PROMPT_SPEC`
   and `MAX_CARDS_PER_RUN` (§22).
4. On the Mac mini: `scripts/agent-schedule-install.sh install <agent>`.

Changing an existing agent's schedule: edit `SCHEDULE` and merge. The
schedule-sync job reinstalls it on the Mac mini within 15 minutes; a new
agent is installed the same way.

### Schedule slots

`SCHEDULE` is a space-separated list of slots, in the Mac mini's local time
(**Pacific**). Plan in CT and subtract 2 hours; each file notes the CT time.

| Slot | Fires |
|---|---|
| `06:00` | daily at 06:00 |
| `Mon@21:30` | Mondays at 21:30 (`Sun`..`Sat`) |
| `05:00=AUDIT` | daily at 05:00, in mode `AUDIT` |

- **Modes** (`KIND=operations` only): a slot's mode runs `PROMPT_<MODE>`
  instead of `PROMPT_NEW`. A fire belongs to the slot whose time most
  recently passed, so a delayed fire keeps its slot's mode. `AGENT_MODE=<MODE>`
  forces one for a manual run.
- **Models:** `MODEL_<MODE>` for one mode, else `MODEL`, else the agent's
  frontmatter, passed to `claude --model`.

### Memory and reports

- `MEMORY=1`: after the run, `scripts/agent-memory-commit.sh` commits the
  agent's `.claude/agent-memory/<agent>/` folder to `main`.
- `REPORTS=1`: the run gets a report folder,
  `agent-reports/<YYYY-MM-DD>/<HH_MM>/` (its start in CT), named in
  its prompt; after the run `scripts/agent-report-commit.sh` commits the new
  `<agent>-<name>.md` files there (500 words each) to `main`. The agent also
  needs `Write` to that folder in its settings and guard.

## Team Chat for an agent

An agent posts to Team Chat (`docs/17-executive-team.md` §10) through the `team-chat` MCP server, signed in as its own Cognito user.

**1. Create the sign-in on an admin machine (the MacBook):**

```
scripts/agent-credentials.py create devx-agent TEST
scripts/agent-credentials.py create devx-agent PROD
```

For each environment, the script:
- creates `<agent>@agents.boroughsim.com` in that admin pool. No email is sent, and no inbox is needed.
- generates a password and sets it as permanent.
- adds the user to `BOROUGH_SIM_TEAM`, plus any `--group` you pass.
- saves the password to `~/.nyc-311/credentials` (directory `700`, file `600`) under `[<agent>]` as `test_password` and `prod_password`.

The password is never printed. Re-running the script rotates it.

**2. Copy `~/.nyc-311/credentials` to the Mac mini,** at the same path, keeping mode `600`. The sign-in refuses a file with a wider mode.

**3. Set `TEAM_CHAT_ENV=TEST` or `PROD`** in `scripts/agent-schedules/<agent>.env`.

On each run, `agent-worktree.sh` calls `scripts/agent-team-chat-config.sh`. That script reads the password from the file and signs in to Cognito. Signing in needs no AWS credentials: the client ids come from `scripts/agent-schedules/team-chat.env`. It then writes the run's MCP config into its own `0700` temporary directory, which `agent-worktree.sh` deletes when the run ends. The tokens are only in that file, read by the MCP server, so parallel runs never share credentials.

If the sign-in fails, the run log shows a `WARN` and the run goes ahead without chat. The agent can't reach chat any other way:
- its settings deny `Read` on `~/.nyc-311/**`;
- `.claude/hooks/team-chat-guard.sh` blocks the credentials file, Cognito calls and direct calls to the chat API from Bash.

### The COO

`coo-agent` follows the same steps, plus three differences:

- **Groups:** create its sign-in with `scripts/agent-credentials.py create coo-agent PROD --group BOROUGH_SIM_OPERATIONS`, so its user is in both `BOROUGH_SIM_TEAM` and `BOROUGH_SIM_OPERATIONS`.
- **Ops tools:** `scripts/agent-schedules/coo-agent.env` sets `OPS_TOOLS=1`. The run's MCP config then adds the `boroughsim-ops` server, which reaches the capacity routes on `api.boroughsim.com` with the same sign-in.
- **Schedule kind:** it is `KIND=operations`. Every fire is one run, with no PRs or issues to count.

Before installing its schedule, do one supervised run by hand:

```
AGENT_TEAM_CHAT_ENV=PROD AGENT_OPS_TOOLS=1 scripts/agent-worktree.sh run coo-agent "Scheduled capacity check. Follow your 'Each run' section."
```

