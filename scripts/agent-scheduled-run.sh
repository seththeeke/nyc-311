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
#   2. pick the mode, by the schedule's KIND:
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
        for pkg in . web-app backend cdk; do
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
: "${BRANCH_PREFIX:?}" "${MAX_OPEN_PRS:?}" "${PROMPT_NEW:?}" "${PROMPT_REVISE:?}"
KIND=${KIND:-pr-limit}
case "$KIND" in
  pr-limit) : ;;
  assigned-issue) : "${PROMPT_RESUME:?}" ;;
  *) die "unknown KIND '$KIND' in $agent.env (pr-limit | assigned-issue)" ;;
esac

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

prs_before=$(open_prs) || die "could not list open PRs"
count=$(printf '%s' "$prs_before" | wc -w | tr -d ' ')
issue=""
pr=""

if [ "$KIND" = "assigned-issue" ]; then
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

  prs_after=$(open_prs || echo "?")
  log "open ${BRANCH_PREFIX}* PRs after run: ${prs_after:-none}"

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
