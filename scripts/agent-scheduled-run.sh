#!/bin/sh
#
# agent-scheduled-run.sh <agent> — one unattended, scheduled run of <agent>.
# launchd calls this and nothing else (scripts/agent-schedule-install.sh), so
# all scheduling logic lives in the repo, not on the machine.
# docs/agent-automation-setup.md is the canonical write-up.
#
# Per run:
#   1. fast-forward the primary checkout (only if on a clean main) and re-run
#      `npm ci` for any package whose lockfile changed — worktrees CoW-clone
#      node_modules from here, so it must track origin/main
#   2. pick the mode, by the schedule's KIND (and, for operations, the
#      slot's mode: SCHEDULE="05:00=AUDIT 08:00=CONVERSE" runs PROMPT_AUDIT or
#      PROMPT_CONVERSE; MODEL_<MODE> or MODEL picks the model):
#      pr-limit (default, devx-agent) — count the agent's open PRs (head branch
#        starts with BRANCH_PREFIX): below MAX_OPEN_PRS → NEW mode, else REVISE
#      assigned-issue (gen-purpose-dev) — poll for ONE issue carrying the label
#        named after the agent, in priority order: RESUME (parked, and a human
#        replied) → REVISE (its PR has unaddressed feedback or a conflict) →
#        NEW (assigned, unclaimed; skipped at MAX_OPEN_PRS). Claim it via
#        agent-issue-state.sh. Nothing to do → IDLE, `claude` is never started.
#   3. `agent-worktree.sh run <agent> "<prompt>"`
#   4. prune logs > 30 days and this agent's kept worktrees > 7 days
#
# A pr-limit run posts nothing to GitHub itself. An assigned-issue run moves
# labels (the claim, and `agent-done` on closed issues) and, when a run dies
# without reaching review or parking, parks the issue with a comment — fail
# closed, never silently retried. Config: scripts/agent-schedules/<agent>.env. Log per run:
# ~/Library/Logs/nyc311-agents/<agent>/<timestamp>.log (AGENT_LOG_ROOT overrides).

set -u

PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"
export PATH

REPO=seththeeke/nyc-311
LOG_RETENTION_DAYS=30
WORKTREE_RETENTION_DAYS=7

die() { printf 'agent-scheduled-run: %s\n' "$*" >&2; exit 1; }
log() { printf '[%s] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*"; }

agent=${1:-}
[ -n "$agent" ] || die "usage: agent-scheduled-run.sh <agent>"

script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
PRIMARY=$(git -C "$script_dir" rev-parse --show-toplevel) || die "not in a git checkout"
config="$script_dir/agent-schedules/$agent.env"
[ -f "$config" ] || die "no schedule config at $config"

log_root=${AGENT_LOG_ROOT:-"$HOME/Library/Logs/nyc311-agents"}
log_dir="$log_root/$agent"
mkdir -p "$log_dir"

# Re-exec'd after a self-update (step 1) — keep appending to the same log.
if [ -z "${AGENT_SCHED_LOG:-}" ]; then
  AGENT_SCHED_LOG="$log_dir/$(date +%Y%m%dT%H%M%S).log"
  export AGENT_SCHED_LOG
fi
exec >>"$AGENT_SCHED_LOG" 2>&1

# ---- 1. keep the primary checkout current -----------------------------------

if [ -z "${AGENT_SCHED_REEXEC:-}" ]; then
  log "=== $agent scheduled run (log: $AGENT_SCHED_LOG)"
  branch=$(git -C "$PRIMARY" branch --show-current)
  dirty=$(git -C "$PRIMARY" status --porcelain | grep -c . || true)
  if [ "$branch" = "main" ] && [ "$dirty" -eq 0 ]; then
    before=$(git -C "$PRIMARY" rev-parse HEAD)
    if git -C "$PRIMARY" pull --quiet --ff-only origin main; then
      after=$(git -C "$PRIMARY" rev-parse HEAD)
      if [ "$before" != "$after" ]; then
        log "primary fast-forwarded ${before%"${before#???????}"}..${after%"${after#???????}"}"
        for pkg in . web-app backend cdk customer/backend; do
          if git -C "$PRIMARY" diff --quiet "$before" "$after" -- "$pkg/package-lock.json"; then
            continue
          fi
          log "lockfile changed in $pkg — npm ci"
          (cd "$PRIMARY/$pkg" && npm ci --no-audit --no-fund) || log "WARN: npm ci failed in $pkg"
        done
        # Re-exec so a change to this script applies to this run, not the next.
        AGENT_SCHED_REEXEC=1 exec /bin/sh "$script_dir/agent-scheduled-run.sh" "$agent"
      fi
    else
      log "WARN: git pull --ff-only failed; continuing on current primary"
    fi
  else
    log "WARN: primary is on '$branch' with $dirty dirty file(s) — not updating it"
  fi
fi

# Always run on the latest committed config/prompts, even when the primary
# couldn't fast-forward: read the .env from a fresh origin/main. (The agent
# definition + permissions already come from origin/main — the worktree is
# created from it.)
git -C "$PRIMARY" fetch --quiet origin main || log "WARN: git fetch origin main failed"
latest_config=$(mktemp)
if git -C "$PRIMARY" show "origin/main:scripts/agent-schedules/$agent.env" >"$latest_config" 2>/dev/null; then
  config="$latest_config"
  log "config + prompts from origin/main @ $(git -C "$PRIMARY" rev-parse --short origin/main)"
else
  log "WARN: no $agent.env on origin/main; using primary's copy"
fi
# shellcheck disable=SC1090
. "$config"
rm -f "$latest_config"
# AGENT_MAX_OPEN_PRS overrides the limit for a manual test (e.g. =0 forces REVISE).
MAX_OPEN_PRS=${AGENT_MAX_OPEN_PRS:-${MAX_OPEN_PRS:-}}
KIND=${KIND:-pr-limit}
# Team Chat environment for this agent's runs (docs/17-executive-team.md §11.4); unset runs without chat.
AGENT_TEAM_CHAT_ENV=${TEAM_CHAT_ENV:-}
export AGENT_TEAM_CHAT_ENV
# The word cap on this agent's top-level chat posts (docs/17 §21.2); unset is the client's default (75), 0 is none.
AGENT_CHAT_POST_WORDS=${CHAT_POST_WORDS:-}
export AGENT_CHAT_POST_WORDS
case "$KIND" in
  pr-limit) : "${BRANCH_PREFIX:?}" "${MAX_OPEN_PRS:?}" "${PROMPT_NEW:?}" "${PROMPT_REVISE:?}" ;;
  assigned-issue) : "${BRANCH_PREFIX:?}" "${MAX_OPEN_PRS:?}" "${PROMPT_NEW:?}" "${PROMPT_REVISE:?}" "${PROMPT_RESUME:?}" ;;
  # An operating agent (docs/17-executive-team.md §12.4): every fire is one run, of PROMPT_<MODE> for its slot's mode (§21.6) or else PROMPT_NEW, with no PRs or issues to count.
  operations) : ;;
  *) die "unknown KIND '$KIND' in $agent.env (pr-limit | assigned-issue | operations)" ;;
esac
# The boroughsim-ops MCP server rides along with team-chat for agents that act on operations.
AGENT_OPS_TOOLS=${OPS_TOOLS:-}
export AGENT_OPS_TOOLS
# The boroughsim-product MCP server (contacts, WBR) for the CPO (docs/17 §17.2).
AGENT_PRODUCT_TOOLS=${PRODUCT_TOOLS:-}
export AGENT_PRODUCT_TOOLS
# Agent memory (docs/17 §17.6): commit the agent's MEMORY.md to main after the run when it changed.
# REPORTS=1 (docs/17 §21.3) gives the run a report folder, set below once the mode is known.
AGENT_MEMORY=${MEMORY:-}
export AGENT_MEMORY

# The slot this fire belongs to (docs/17 §21.6): the SCHEDULE slot whose time
# most recently passed, so a fire launchd delays (asleep, or skipped while a
# run held the lock) still gets its own slot's mode. AGENT_MODE overrides it
# for a manual run. Prints the slot's MODE, empty for a slot without one.
slot_mode() {
  now_wd=$(date +%w); now_h=$(date +%H); now_m=$(date +%M)
  now=$(( now_wd * 1440 + ${now_h#0} * 60 + ${now_m#0} ))
  best=""; best_delta=""
  for slot in $SCHEDULE; do
    t=${slot%%=*}; m=""
    [ "$t" != "$slot" ] && m=${slot#*=}
    day=""
    case "$t" in *@*) day=${t%%@*}; t=${t#*@} ;; esac
    h=${t%%:*}; mm=${t#*:}
    at=$(( ${h#0} * 60 + ${mm#0} ))
    case "$day" in
      '') delta=$(( ((now % 1440) - at + 1440) % 1440 )) ;;
      *)
        case "$day" in Sun) d=0 ;; Mon) d=1 ;; Tue) d=2 ;; Wed) d=3 ;; Thu) d=4 ;; Fri) d=5 ;; Sat) d=6 ;; *) continue ;; esac
        delta=$(( (now - (d * 1440 + at) + 10080) % 10080 )) ;;
    esac
    if [ -z "$best_delta" ] || [ "$delta" -lt "$best_delta" ]; then
      best_delta=$delta; best=$m
    fi
  done
  printf '%s' "$best"
}
SLOT_MODE=${AGENT_MODE:-$(slot_mode)}
# The model for this run: MODEL_<MODE>, else MODEL, else the agent's default.
AGENT_MODEL=""
if [ -n "$SLOT_MODE" ]; then
  eval "AGENT_MODEL=\${MODEL_$SLOT_MODE:-}"
fi
AGENT_MODEL=${AGENT_MODEL:-${MODEL:-}}
export AGENT_MODEL

# ---- lock: one run per agent at a time ---------------------------------------

lock="$log_dir/.run.lock"
if ! mkdir "$lock" 2>/dev/null; then
  held=$(cat "$lock/pid" 2>/dev/null || true)
  if [ -n "$held" ] && kill -0 "$held" 2>/dev/null; then
    log "another $agent run (pid $held) is in progress — skipping"
    exit 0
  fi
  log "reclaiming stale lock (pid ${held:-?})"
  rm -rf "$lock"
  mkdir "$lock" || die "could not take $lock"
fi
echo $$ >"$lock/pid"
trap 'rm -rf "$lock"' EXIT INT TERM

# ---- preflight ---------------------------------------------------------------

command -v claude >/dev/null 2>&1 || die "'claude' not on PATH"
command -v gh >/dev/null 2>&1 || die "'gh' not on PATH"
gh auth status >/dev/null 2>&1 || die "gh is not authenticated (run: gh auth login)"

open_prs() {
  gh pr list --repo "$REPO" --state open --limit 100 --json number,headRefName \
    --jq "[.[] | select(.headRefName | startswith(\"$BRANCH_PREFIX\")) | .number] | map(\"#\" + tostring) | join(\" \")"
}

# ---- assigned-issue helpers (KIND=assigned-issue) ----------------------------

# The agent posts as the repo owner, so authorship can't tell its comments from
# a human's; every comment it (or this script) posts starts with this marker.
MARKER="<!-- $agent -->"

issue_state() { "$script_dir/agent-issue-state.sh" "$agent" "$@"; }

# Closed issues this agent worked → agent-done.
sweep_done() {
  gh issue list --repo "$REPO" --state closed --label "$agent" --limit 100 --json number,labels \
    --jq '.[] | [.labels[].name] as $l
          | select(($l | index("agent-done") | not)
              and any($l[]; . == "agent-planning" or . == "agent-in-progress"
                            or . == "agent-pr-review" or . == "agent-blocked"))
          | .number' |
    while IFS= read -r n; do
      [ -n "$n" ] || continue
      log "$(issue_state "$n" done 2>&1)"
    done
}

# An open issue still in planning/in-progress while no run holds the lock means
# a run died mid-flight. Park it (fail closed); a human reply resumes it.
park_orphans() {
  gh issue list --repo "$REPO" --state open --label "$agent" --limit 100 --json number,labels \
    --jq '.[] | select(any(.labels[]; .name == "agent-planning" or .name == "agent-in-progress")) | .number' |
    while IFS= read -r n; do
      [ -n "$n" ] || continue
      log "parking #$n: $1"
      issue_state "$n" blocked >/dev/null || { log "WARN: could not park #$n"; continue; }
      gh issue comment "$n" --repo "$REPO" --body "$MARKER
**Parked (\`agent-blocked\`).** $1 Nothing was merged or closed. Any work that was pushed is on the issue's \`${BRANCH_PREFIX}$n-*\` branch.

Reply on this issue to have the next scheduled run pick it back up, or remove the \`$agent\` label to take it back." \
        >/dev/null || log "WARN: could not comment on #$n"
    done
}

# Oldest parked issue whose newest comment is a human's (no marker).
pick_resume() {
  gh issue list --repo "$REPO" --state open --label "$agent" --label agent-blocked --limit 100 \
    --json number,comments |
    jq -r --arg m "$MARKER" '[.[] | select((.comments | length) > 0
          and (.comments[-1].body | startswith($m) | not))]
        | sort_by(.number) | .[0].number // empty'
}

# Exit 0 when PR $1 has a merge conflict or review feedback newer than the
# agent's last marked comment. A conflict the agent already gave up on (its
# last marked comment says `conflict-unresolved`) doesn't count again until a
# human comments — otherwise every fire would re-run the same failed merge.
pr_needs_tending() {
  verdict=$(gh pr view "$1" --repo "$REPO" --json mergeable,comments,reviews |
    jq -r --arg m "$MARKER" '
      ([.comments[] | {b: .body, t: .createdAt}]
        + [.reviews[] | select(.body != "") | {b: .body, t: .submittedAt}] | sort_by(.t)) as $all
      | [$all[] | select(.b | startswith($m))] as $mine
      | ($mine | last | .t // "") as $last
      | ($mine | last | .b // "" | contains("conflict-unresolved")) as $gaveUp
      | ((.mergeable == "CONFLICTING" and ($gaveUp | not))
          or any($all[]; (.b | startswith($m) | not) and .t > $last)) as $needs
      | "\($needs) \($last)"') || return 1
  [ "${verdict%% *}" = "true" ] && return 0
  last=${verdict#* }
  gh api "repos/$REPO/pulls/$1/comments" --paginate |
    jq -r --arg last "$last" 'any(.[]; .created_at > $last)' | grep -q true
}

# First open agent PR that needs tending, as "<pr> <issue>".
pick_revise() {
  gh pr list --repo "$REPO" --state open --limit 100 --json number,headRefName \
    --jq ".[] | select(.headRefName | startswith(\"$BRANCH_PREFIX\")) | \"\(.number) \(.headRefName)\"" |
    while read -r pr head; do
      [ -n "$pr" ] || continue
      n=${head#"$BRANCH_PREFIX"}
      n=${n%%-*}
      case "$n" in '' | *[!0-9]*) continue ;; esac
      if pr_needs_tending "$pr"; then
        printf '%s %s\n' "$pr" "$n"
        break
      fi
    done
}

# Oldest assigned issue no run has claimed yet (assignment label, no state label).
pick_new() {
  gh issue list --repo "$REPO" --state open --label "$agent" --limit 100 --json number,labels \
    --jq '[.[] | select(any(.labels[]; .name == "agent-planning" or .name == "agent-in-progress"
              or .name == "agent-pr-review" or .name == "agent-blocked"
              or .name == "agent-done" or .name == "needs-info") | not)]
          | sort_by(.number) | .[0].number // empty'
}

# ---- 2. pick the mode --------------------------------------------------------

issue=""
pr=""
if [ "$KIND" = "operations" ]; then
  prs_before=""
  count=0
else
  prs_before=$(open_prs) || die "could not list open PRs"
  count=$(printf '%s' "$prs_before" | wc -w | tr -d ' ')
fi

if [ "$KIND" = "operations" ]; then
  mode=RUN
  prompt="$PROMPT_NEW"
  if [ -n "$SLOT_MODE" ]; then
    eval "prompt=\${PROMPT_$SLOT_MODE:-}"
    [ -n "$prompt" ] || die "slot mode $SLOT_MODE has no PROMPT_$SLOT_MODE in $agent.env"
    mode=$SLOT_MODE
  fi
  log "operations run → $mode${AGENT_MODEL:+ (model $AGENT_MODEL)}"
elif [ "$KIND" = "assigned-issue" ]; then
  command -v jq >/dev/null 2>&1 || die "'jq' not on PATH"
  issue_state ensure-labels || die "could not ensure the agent labels exist"
  sweep_done
  park_orphans "A previous run ended without reaching review or parking itself."

  mode=IDLE
  issue=$(pick_resume) || die "could not list parked issues"
  if [ -n "$issue" ]; then
    mode=RESUME
    prompt="$PROMPT_RESUME #$issue"
    issue_state "$issue" in-progress >/dev/null || die "could not claim #$issue"
  else
    revise=$(pick_revise) || die "could not list PRs to revise"
    if [ -n "$revise" ]; then
      mode=REVISE
      pr=${revise%% *}
      issue=${revise#* }
      prompt="$PROMPT_REVISE PR #$pr (issue #$issue)"
    elif [ "$count" -ge "$MAX_OPEN_PRS" ]; then
      log "open PR limit reached — not claiming a new issue"
    else
      issue=$(pick_new) || die "could not list assigned issues"
      if [ -n "$issue" ]; then
        mode=NEW
        prompt="$PROMPT_NEW #$issue"
        issue_state "$issue" planning >/dev/null || die "could not claim #$issue"
      fi
    fi
  fi
  log "open ${BRANCH_PREFIX}* PRs: $count (${prs_before:-none}), limit $MAX_OPEN_PRS → $mode${issue:+ #$issue}${pr:+ (PR #$pr)}"
elif [ "$count" -ge "$MAX_OPEN_PRS" ]; then
  mode=REVISE
  prompt="$PROMPT_REVISE $prs_before"
  log "open ${BRANCH_PREFIX}* PRs: $count (${prs_before:-none}), limit $MAX_OPEN_PRS → $mode mode"
else
  mode=NEW
  prompt="$PROMPT_NEW"
  log "open ${BRANCH_PREFIX}* PRs: $count (${prs_before:-none}), limit $MAX_OPEN_PRS → $mode mode"
fi

# Reports (docs/17 §21.3): this run's folder, by its start in CT, committed after the run.
AGENT_REPORT_DIR=""
if [ -n "${REPORTS:-}" ] && [ "$mode" != "IDLE" ]; then
  AGENT_REPORT_DIR=".claude/agent-reports/$(TZ=America/Chicago date +%Y-%m-%d)/$(TZ=America/Chicago date +%H_%M)"
  prompt="$prompt Your report folder for this run is $AGENT_REPORT_DIR/ (create it): write each report there as $agent-<name>.md, at most 500 words."
  log "report folder: $AGENT_REPORT_DIR"
fi
export AGENT_REPORT_DIR

# Usage (docs/17 §21.4): the last 24 hours of scheduled runs' Claude usage, appended to the prompt.
if [ -n "${USAGE_SUMMARY:-}" ] && [ "$mode" != "IDLE" ]; then
  if usage=$("$script_dir/agent-usage-summary.sh" 24 2>&1); then
    prompt="$prompt

$usage"
  else
    log "WARN: agent-usage-summary failed: $usage"
    prompt="$prompt

Claude usage: the usage summary failed on the Mac mini; say so in your report."
  fi
fi

# ---- 3. run the agent --------------------------------------------------------

status=0
if [ "$mode" = "IDLE" ]; then
  log "nothing assigned to $agent needs work — not starting claude"
else
  report="${AGENT_SCHED_LOG%.log}.report.md"
  started=$(date +%s)
  "$script_dir/agent-worktree.sh" run "$agent" "$prompt" >"$report"
  status=$?
  elapsed=$(( $(date +%s) - started ))
  log "agent exited $status after $((elapsed / 60))m$((elapsed % 60))s — final report:"
  cat "$report"
  printf '\n'

  # The agent reports its Team Chat post (docs/17-executive-team.md §11.4); the script never posts itself.
  if [ -n "${AGENT_TEAM_CHAT_ENV:-}" ]; then
    chat_line=$(grep -m1 'Chat post:' "$report" || true)
    if [ -n "$chat_line" ]; then log "team-chat: ${chat_line#*Chat post:}"; else log "WARN: no chat post reported"; fi
  fi

  if [ "$KIND" != "operations" ]; then
    prs_after=$(open_prs || echo "?")
    log "open ${BRANCH_PREFIX}* PRs after run: ${prs_after:-none}"
  fi

  if [ "$KIND" = "assigned-issue" ]; then
    park_orphans "The run exited with status $status without reaching review or parking itself."
    if [ "$mode" = "REVISE" ] && pr_needs_tending "$pr"; then
      log "PR #$pr still needs tending after the run — leaving it for a human"
      gh pr comment "$pr" --repo "$REPO" --body "$MARKER
**Revision run ended without resolving this PR** (exit $status; conflict-unresolved). Nothing was merged, closed, or force-pushed. A new comment here has the next scheduled run try again." \
        >/dev/null || log "WARN: could not comment on PR #$pr"
    fi
  fi
fi

# ---- 4. housekeeping ---------------------------------------------------------

find "$log_dir" -maxdepth 1 -type f \( -name '*.log' -o -name '*.report.md' \) \
  -mtime +"$LOG_RETENTION_DAYS" -delete 2>/dev/null || true

cutoff=$(( $(date +%s) - WORKTREE_RETENTION_DAYS * 86400 ))
"$script_dir/agent-worktree.sh" ls 2>/dev/null | cut -f1 | while IFS= read -r wt; do
  name=$(basename -- "$wt")
  case "$name" in "$agent"-*) : ;; *) continue ;; esac
  epoch=${name#"$agent"-}
  epoch=${epoch%%-*}
  case "$epoch" in '' | *[!0-9]*) continue ;; esac
  if [ "$epoch" -lt "$cutoff" ]; then
    log "removing kept worktree older than ${WORKTREE_RETENTION_DAYS}d: $name"
    "$script_dir/agent-worktree.sh" rm "$name" || true
  fi
done

log "=== done ($mode, exit $status)"
exit "$status"
