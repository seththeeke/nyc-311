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

### AWS access — the `nyc311-agent` profile

> **Not created yet.** Until the steps below are run, `gen-purpose-dev` has no
> AWS access at all: its allowlist permits only `aws --profile nyc311-agent …`
> and denies the admin `nyc311` profile outright. It works fine without AWS —
> it just can't inspect live resources.

The agent investigates under its own IAM principal — never a human admin
credential.

| | |
|---|---|
| Principal | IAM role `Nyc311AgentReadOnly`, account `178280182163` |
| Assumed by | a dedicated IAM user `nyc311-agent-host` whose **only** permission is `sts:AssumeRole` + `sts:SetSourceIdentity` on that role — its access key is the only long-lived AWS secret on the agent host |
| Session | 1 hour max (`MaxSessionDuration` 3600); no long-lived keys for the role itself |
| Attribution | `sts:SourceIdentity` = the agent name, required by the trust policy, so every CloudTrail event carries `userIdentity.sessionContext.sourceIdentity = gen-purpose-dev` |
| Can | describe/list/get on the resources it inspects: CloudFormation, CloudWatch + Logs (incl. Insights queries), CodePipeline/CodeBuild, Lambda config, DynamoDB table metadata, SQS attributes, Step Functions, EventBridge/Scheduler, API Gateway, Glue catalog, Athena metadata, S3 bucket listing |
| Cannot | any write; read table items, S3 objects, or Lambda code; read secrets or decrypt (`secretsmanager:GetSecretValue`, `ssm:GetParameter*`, `kms:Decrypt` explicitly denied) |

Anything that would change a real resource becomes a note on the ticket for a
human, not an action. Heavy validation runs in CI on the agent's PR, not from
its credentials.

**Setup** (mutates IAM — run it yourself, with the admin profile; `CLAUDE.md`
§3). Trust policy, `trust.json`:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": { "AWS": "arn:aws:iam::178280182163:user/nyc311-agent-host" },
      "Action": ["sts:AssumeRole", "sts:SetSourceIdentity"],
      "Condition": { "StringLike": { "sts:SourceIdentity": ["gen-purpose-dev", "devx-agent"] } }
    }
  ]
}
```

Permissions, `policy.json`:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "ReadOnlyInvestigation",
      "Effect": "Allow",
      "Action": [
        "cloudformation:Describe*", "cloudformation:List*", "cloudformation:GetTemplate*",
        "cloudwatch:Describe*", "cloudwatch:Get*", "cloudwatch:List*",
        "logs:Describe*", "logs:Get*", "logs:FilterLogEvents", "logs:StartQuery", "logs:StopQuery",
        "codepipeline:Get*", "codepipeline:List*",
        "codebuild:BatchGet*", "codebuild:List*",
        "lambda:List*", "lambda:GetFunctionConfiguration", "lambda:GetPolicy", "lambda:GetEventSourceMapping",
        "dynamodb:Describe*", "dynamodb:List*",
        "sqs:GetQueueAttributes", "sqs:GetQueueUrl", "sqs:List*",
        "states:Describe*", "states:List*", "states:GetExecutionHistory",
        "events:Describe*", "events:List*", "scheduler:Get*", "scheduler:List*",
        "apigateway:GET",
        "glue:GetDatabase*", "glue:GetTable*", "glue:GetPartition*",
        "athena:Get*", "athena:List*",
        "s3:ListAllMyBuckets", "s3:ListBucket", "s3:GetBucketLocation",
        "firehose:Describe*", "firehose:List*",
        "cognito-idp:Describe*", "cognito-idp:List*",
        "cloudfront:Get*", "cloudfront:List*"
      ],
      "Resource": "*"
    },
    {
      "Sid": "NeverSecrets",
      "Effect": "Deny",
      "Action": ["secretsmanager:GetSecretValue", "ssm:GetParameter*", "kms:Decrypt", "athena:GetQueryResults"],
      "Resource": "*"
    }
  ]
}
```

```
aws --profile nyc311 iam create-user --user-name nyc311-agent-host
aws --profile nyc311 iam create-role --role-name Nyc311AgentReadOnly \
  --max-session-duration 3600 --assume-role-policy-document file://trust.json
aws --profile nyc311 iam put-role-policy --role-name Nyc311AgentReadOnly \
  --policy-name ReadOnlyInvestigation --policy-document file://policy.json
aws --profile nyc311 iam put-user-policy --user-name nyc311-agent-host \
  --policy-name AssumeAgentRole --policy-document '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Action":["sts:AssumeRole","sts:SetSourceIdentity"],"Resource":"arn:aws:iam::178280182163:role/Nyc311AgentReadOnly"}]}'
aws --profile nyc311 iam create-access-key --user-name nyc311-agent-host   # → [nyc311-agent-host] in ~/.aws/credentials on the agent host
```

The AWS CLI can't set a source identity from a plain `role_arn` profile, so
the profile uses a `credential_process` that calls `assume-role` with one. On
the agent host, save as `~/.aws/nyc311-agent-credentials.sh` (`chmod 700`):

```sh
#!/bin/sh
exec aws --profile nyc311-agent-host sts assume-role \
  --role-arn arn:aws:iam::178280182163:role/Nyc311AgentReadOnly \
  --role-session-name "$1" --source-identity "$1" --duration-seconds 3600 \
  --query '{Version:`1`,AccessKeyId:Credentials.AccessKeyId,SecretAccessKey:Credentials.SecretAccessKey,SessionToken:Credentials.SessionToken,Expiration:Credentials.Expiration}' \
  --output json
```

and in `~/.aws/config`:

```
[profile nyc311-agent]
region = us-east-1
credential_process = /Users/<you>/.aws/nyc311-agent-credentials.sh gen-purpose-dev
```

**Verify** (the acceptance check — a read works, a write is refused, and the
call is attributed):

```
aws --profile nyc311-agent sts get-caller-identity          # …assumed-role/Nyc311AgentReadOnly/gen-purpose-dev
aws --profile nyc311-agent cloudformation describe-stacks --stack-name Nyc311-Test --query 'Stacks[0].StackStatus'
aws --profile nyc311-agent sqs purge-queue --queue-url <any Nyc311-Test queue url>   # must fail: AccessDenied
```

The agent host must **not** have the admin `nyc311` profile configured — the
allowlist denies it, but an absent credential is the stronger guarantee.

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
