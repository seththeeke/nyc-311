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
#   2. count the agent's open PRs (head branch starts with BRANCH_PREFIX):
#      below MAX_OPEN_PRS → NEW mode, else REVISE mode (address PR comments)
#   3. `agent-worktree.sh run <agent> "<prompt>"`
#   4. post a summary comment on the agent's pinned "run log" issue
#   5. prune logs > 30 days and this agent's kept worktrees > 7 days
#
# Config: scripts/agent-schedules/<agent>.env. Full log per run:
# ~/Library/Logs/nyc311-agents/<agent>/<timestamp>.log (AGENT_LOG_ROOT overrides).

set -u

PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"
export PATH

REPO=seththeeke/nyc-311
RUN_LOG_LABEL=agent-run-log
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

# shellcheck disable=SC1090
. "$config"
# AGENT_MAX_OPEN_PRS overrides the limit for a manual test (e.g. =0 forces REVISE).
MAX_OPEN_PRS=${AGENT_MAX_OPEN_PRS:-${MAX_OPEN_PRS:-}}
: "${BRANCH_PREFIX:?}" "${MAX_OPEN_PRS:?}" "${PROMPT_NEW:?}" "${PROMPT_REVISE:?}"

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

# ---- 2. pick the mode --------------------------------------------------------

prs_before=$(open_prs) || die "could not list open PRs"
count=$(printf '%s' "$prs_before" | wc -w | tr -d ' ')
if [ "$count" -ge "$MAX_OPEN_PRS" ]; then
  mode=REVISE
  prompt="$PROMPT_REVISE $prs_before"
else
  mode=NEW
  prompt="$PROMPT_NEW"
fi
log "open ${BRANCH_PREFIX}* PRs: $count (${prs_before:-none}), limit $MAX_OPEN_PRS → $mode mode"

# ---- 3. run the agent --------------------------------------------------------

report="${AGENT_SCHED_LOG%.log}.report.md"
started=$(date +%s)
"$script_dir/agent-worktree.sh" run "$agent" "$prompt" >"$report"
status=$?
elapsed=$(( $(date +%s) - started ))
log "agent exited $status after $((elapsed / 60))m$((elapsed % 60))s — final report:"
cat "$report"
printf '\n'

prs_after=$(open_prs || echo "?")

# ---- 4. post to the run-log issue --------------------------------------------

issue_title="$agent run log"
issue=$(gh issue list --repo "$REPO" --state open --label "$RUN_LOG_LABEL" --search "in:title \"$issue_title\"" \
  --json number,title --jq ".[] | select(.title == \"$issue_title\") | .number" 2>/dev/null | head -1)
if [ -z "$issue" ]; then
  gh label create "$RUN_LOG_LABEL" --repo "$REPO" --color 5319E7 \
    --description "One pinned issue per scheduled agent; each run posts a comment" >/dev/null 2>&1 || true
  body=$(mktemp)
  printf 'Each scheduled run of `%s` posts a comment here. See `docs/agent-automation-setup.md`.\n' "$agent" >"$body"
  url=$(gh issue create --repo "$REPO" --title "$issue_title" --label "$RUN_LOG_LABEL" --body-file "$body") || url=
  rm -f "$body"
  issue=${url##*/}
  [ -n "$issue" ] && gh issue pin "$issue" --repo "$REPO" >/dev/null 2>&1 || true
fi

if [ -n "$issue" ]; then
  [ "$status" -eq 0 ] && verdict="✅ exit 0" || verdict="❌ exit $status"
  comment=$(mktemp)
  {
    printf '<!-- %s-run -->\n' "$agent"
    printf '### %s — %s mode — %s\n\n' "$(date '+%Y-%m-%d %H:%M %Z')" "$mode" "$verdict"
    printf '| | |\n|---|---|\n'
    printf '| Duration | %sm%ss |\n' "$((elapsed / 60))" "$((elapsed % 60))"
    printf '| Open `%s*` PRs before | %s |\n' "$BRANCH_PREFIX" "${prs_before:-none}"
    printf '| Open `%s*` PRs after | %s |\n' "$BRANCH_PREFIX" "${prs_after:-none}"
    printf '| Host log | `%s` |\n\n' "$(basename -- "$AGENT_SCHED_LOG")"
    printf '<details><summary>Agent final report</summary>\n\n'
    if [ -s "$report" ]; then head -c 50000 "$report"; else printf '_(empty — see host log)_'; fi
    printf '\n\n</details>\n'
  } >"$comment"
  gh issue comment "$issue" --repo "$REPO" --body-file "$comment" >/dev/null \
    && log "posted summary to #$issue" || log "WARN: could not comment on #$issue"
  rm -f "$comment"
else
  log "WARN: no run-log issue available; summary not posted"
fi

# ---- 5. housekeeping ---------------------------------------------------------

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
