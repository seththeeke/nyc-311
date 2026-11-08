# Agent automation — scheduled autonomous runs

> **Being replaced** by the local orchestrator app — see
> `agent-orchestration-spec.md`. This launchd setup stays live until that
> spec's migration (§12) completes.

How the repo's autonomous agents (today: `devx-agent` and `gen-purpose-dev`)
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

`gen-purpose-dev` — works only issues you assign it (`KIND="assigned-issue"`):

```
launchd (every 2h, 07:00–21:00)
  └─ scripts/agent-scheduled-run.sh gen-purpose-dev
       1. as above
       2. closed issues it worked → agent-done; issues a dead run left in
          planning/in-progress → agent-blocked + a comment (fail closed)
          then pick exactly ONE, in this order:
            RESUME  a parked issue whose newest comment is a human's
            REVISE  an open gen-purpose-dev/* PR with unaddressed review
                    feedback or a merge conflict
            NEW     the oldest issue carrying `gen-purpose-dev` and no state
                    label (skipped while ≥ 3 of its PRs are open)
            IDLE    nothing to do → stop here; `claude` is never started
          and claim it (NEW → agent-planning, RESUME → agent-in-progress)
       3. scripts/agent-worktree.sh run gen-purpose-dev "<mode prompt> #<issue>"
          afterwards: still planning/in-progress → agent-blocked + a comment
       4. as above
```

| Piece | Where |
|---|---|
| Schedule, kind, PR limit, branch prefix, mode prompts | `scripts/agent-schedules/<agent>.env` |
| Scheduled-run logic | `scripts/agent-scheduled-run.sh` |
| Issue label state machine (assigned-issue agents) | `scripts/agent-issue-state.sh` |
| Per-agent `main`/merge/deploy guard hook | `.claude/hooks/<agent>-guard.sh` |
| launchd install / uninstall / status / kick | `scripts/agent-schedule-install.sh` |
| Worktree isolation | `scripts/agent-worktree.sh` (`CLAUDE.md` §9) |
| What the agent may do (complete allowlist + denies) | `.claude/agent-settings/<agent>.json` |
| Agent behaviour, incl. *Revision mode* | `.claude/agents/<agent>.md` |

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

## gen-purpose-dev — assigning it work

`gen-purpose-dev` (`.claude/agents/gen-purpose-dev.md`) is the counterpart to
`devx-agent`: same rails, but it works the tickets it's given and never finds
its own.

**To assign an issue, add the `gen-purpose-dev` label.** That label *is* the
assignment — named after the agent so each future agent gets its own. Remove
the label at any point to take the issue back; the agent won't touch an issue
without it. To run one immediately instead of waiting for the next poll:

```
scripts/agent-worktree.sh run gen-purpose-dev "Work issue #<n>"
```

### What you'll see on the issue

| Stage | Label(s) | What happened |
|---|---|---|
| todo | `gen-purpose-dev` only | assigned, not yet picked up |
| planning | `agent-planning` | claimed; reading the issue and code |
| in-progress | `agent-in-progress` | **plan comment posted** (approach, files, acceptance-criteria checkboxes it ticks as it goes); code under way |
| pr-review | `agent-pr-review` | draft PR open from `gen-purpose-dev/<n>-<slug>`; closing comment links it |
| needs-info | `agent-blocked` + `needs-info` | it asked a question and stopped |
| blocked | `agent-blocked` | a run failed or died; details in the comment |
| done | `agent-done` | you merged the PR and the issue closed |

The stage labels are shared by every assigned-issue agent; the agent-name
label says whose issue it is. All moves go through
`scripts/agent-issue-state.sh <agent> <issue> <state>`, which refuses an
unassigned issue and any transition outside its table (documented in the
script header). `… <issue> show` prints the current state; the labels are
created on first use.

### Questions: park, don't block

The agent sorts each unknown into *proceed with a documented assumption*
(listed in the plan) or *park and ask*. When it parks it pushes any work in
progress to its branch, posts one **Parked** comment — the question(s), with
options and its own pick, plus a *State* block (stage, branch + SHA, done so
far, what's next) — sets `needs-info`, and exits.

**Reply on the issue to resume it.** The next poll sees a human comment newer
than the agent's and runs it in RESUME mode; it re-reads the whole thread and
its *State* block first, so it doesn't re-ask. There is no timeout: a parked
issue stays parked until someone replies, and nothing is ever auto-closed,
auto-merged, or assumed from silence.

The parked state lives **on the ticket** (the *State* block) and on the pushed
branch, not in a file on the host: the run's worktree is deleted when it
exits, and the ticket is the one place both the next run and a human can read.

### Review

The PR is a **draft**; mark it ready and merge it yourself — the agent can't
(denied in its allowlist and blocked by its guard hook). Comment on the PR to
request changes: the next poll runs REVISE mode, pushes new commits on top
(never a rebase or force-push), and replies. If it can't resolve a conflict or
get the loop green it says so with the token `conflict-unresolved` and waits
for your next comment rather than retrying every poll.

### Safety rails

| Rail | Where | What it stops |
|---|---|---|
| Agent rules | `.claude/agents/gen-purpose-dev.md` *Absolute rules* | unassigned work, scope creep, `main`, merging/closing, infra mutation |
| Allowlist + denies | `.claude/agent-settings/gen-purpose-dev.json` | everything not listed (headless runs deny, never prompt); explicit denies for merge/close, force-push, `reset --hard`, deploy, and the admin `nyc311` AWS profile |
| Guard hook | `.claude/hooks/gen-purpose-dev-guard.sh` | commit on / push to `main`, force-push, `reset --hard`, `gh pr merge`/`close`, `gh issue close`, non-draft `gh pr create`, deploy — holds even when the agent is started without the allowlist; fails closed |
| Worktree | `scripts/agent-worktree.sh` | touching your checkout or another run's |
| Wrapper | `scripts/agent-scheduled-run.sh` | two runs at once (lock), a dead run silently retrying (parks it) |

Not yet covered, and waiting on the orchestrator
(`agent-orchestration-spec.md`): a per-run wall-clock cap, cost circuit
breaker, and a run trace in a UI. Today a run's trace is its host log.

### AWS access — one role per agent

Each agent that needs AWS gets its own IAM user, holding its own access key, and its own role, which only that user can assume. No agent uses a human admin credential. A leaked or misused key reaches only that agent, and one agent can be disabled or rotated without touching the others. Users and roles are defined in CDK under `cdk/agents/`, deployed with `Nyc311PipelineStack`.

| Piece | What it is |
|---|---|
| `devx-agent` (user) | `devx-agent`'s IAM user. It holds no permissions beyond assuming `Nyc311DevxAgentRole`. Its access key is created by hand, never in CDK. |
| `Nyc311DevxAgentRole` | `devx-agent`'s role: AWS `ReadOnlyAccess` for Test and Prod (one account), with Secrets Manager values, SSM parameters and KMS decrypts denied. Assumable only by the `devx-agent` user with source identity `devx-agent`, so CloudTrail attributes every call. One-hour sessions. |

`gen-purpose-dev` has no user or role yet. Its allowlist names `nyc311-agent`, which doesn't exist, so it runs without AWS. `coo-agent` needs no AWS role: everything it does goes through Cognito.

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
   `customer/backend/` — worktrees CoW-clone these. (Newer npm blocks
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
   committer-stamp hook already requires it).
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
   `MAX_OPEN_PRS`, `PROMPT_NEW`, `PROMPT_REVISE`; for an agent that works
   assigned issues, also `KIND="assigned-issue"` and `PROMPT_RESUME` (its
   assignment label is its own name — nothing else to configure).
4. On the Mac mini: `scripts/agent-schedule-install.sh install <agent>`.

Changing an existing agent's schedule: edit `SCHEDULE`, merge, then re-run
`install` on the machine (the only change that needs a machine-side step).

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

