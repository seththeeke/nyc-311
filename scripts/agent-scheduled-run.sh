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
#      board (gen-purpose-dev, docs/17-executive-team.md §22.6) — list the
#        agent's cards on the project board (agent-board.sh): SPEC for each
#        card in Assigned that isn't parked, oldest first, at most
#        MAX_CARDS_PER_RUN. Nothing to do → IDLE, `claude` is never started.
#   3. `agent-worktree.sh run <agent> "<prompt>"` — for board, once per card,
#      each in its own worktree
#   4. prune logs > 30 days and this agent's kept worktrees > 7 days
#
# A pr-limit run posts nothing to GitHub itself. A board run, when a card's
# session ends without moving the card on or parking it, parks it with a
# comment — fail closed, never silently retried. Config: scripts/agent-schedules/<agent>.env. Log per run:
# ~/Library/Logs/nyc311-agents/<agent>/<timestamp>.log (AGENT_LOG_ROOT overrides).
#
# A manual run (the agent monitor's Run button, agent-web-app/SPEC.md §5.1)
# sets AGENT_MANUAL=1 and may set AGENT_PROMPT (added to the scheduled
# prompt, or replacing it with AGENT_PROMPT_MODE=replace), AGENT_MODE (a slot
# mode) and AGENT_CHAT_ENV (TEST to keep its chat posts out of Prod).

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
        # Same list as agent-worktree.sh's NODE_PKGS. A package with no
        # node_modules installs too, so a newly listed one isn't skipped
        # until its lockfile next changes (#175).
        for pkg in . web-app backend cdk customer/backend agent-web-app; do
          if [ -d "$PRIMARY/$pkg/node_modules" ] \
            && git -C "$PRIMARY" diff --quiet "$before" "$after" -- "$pkg/package-lock.json"; then
            continue
          fi
          log "lockfile changed or node_modules missing in $pkg — npm ci"
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
AGENT_TEAM_CHAT_ENV=${AGENT_CHAT_ENV:-${TEAM_CHAT_ENV:-}}
export AGENT_TEAM_CHAT_ENV
# The word cap on this agent's top-level chat posts (docs/17 §21.2); unset is the client's default (75), 0 is none.
AGENT_CHAT_POST_WORDS=${CHAT_POST_WORDS:-}
export AGENT_CHAT_POST_WORDS
case "$KIND" in
  pr-limit) : "${BRANCH_PREFIX:?}" "${MAX_OPEN_PRS:?}" "${PROMPT_NEW:?}" "${PROMPT_REVISE:?}" ;;
  board) : "${PROMPT_SPEC:?}" "${MAX_CARDS_PER_RUN:?}" ;;
  # An operating agent (docs/17-executive-team.md §12.4): every fire is one run, of PROMPT_<MODE> for its slot's mode (§21.6) or else PROMPT_NEW, with no PRs or issues to count.
  operations) : ;;
  *) die "unknown KIND '$KIND' in $agent.env (pr-limit | board | operations)" ;;
esac
# The boroughsim-ops MCP server rides along with team-chat for agents that act on operations.
AGENT_OPS_TOOLS=${OPS_TOOLS:-}
export AGENT_OPS_TOOLS
# The boroughsim-product MCP server (contacts, WBR) for the CPO (docs/17 §17.2).
AGENT_PRODUCT_TOOLS=${PRODUCT_TOOLS:-}
export AGENT_PRODUCT_TOOLS
# The boroughsim-engineering MCP server (queries, flags) for the Software Engineer (docs/17 §22.9).
AGENT_ENGINEERING_TOOLS=${ENGINEERING_TOOLS:-}
export AGENT_ENGINEERING_TOOLS
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
# The run's warehouse query budget for the product tools (docs/17 §21.4): PRODUCT_QUERY_LIMIT_<MODE>, else PRODUCT_QUERY_LIMIT, else the client's cap.
AGENT_PRODUCT_QUERY_LIMIT=""
if [ -n "$SLOT_MODE" ]; then
  eval "AGENT_PRODUCT_QUERY_LIMIT=\${PRODUCT_QUERY_LIMIT_$SLOT_MODE:-}"
fi
AGENT_PRODUCT_QUERY_LIMIT=${AGENT_PRODUCT_QUERY_LIMIT:-${PRODUCT_QUERY_LIMIT:-}}
export AGENT_PRODUCT_QUERY_LIMIT
# The engineering tools' query budget (docs/17 §22.9), set the same way.
AGENT_ENGINEERING_QUERY_LIMIT=""
if [ -n "$SLOT_MODE" ]; then
  eval "AGENT_ENGINEERING_QUERY_LIMIT=\${ENGINEERING_QUERY_LIMIT_$SLOT_MODE:-}"
fi
AGENT_ENGINEERING_QUERY_LIMIT=${AGENT_ENGINEERING_QUERY_LIMIT:-${ENGINEERING_QUERY_LIMIT:-}}
export AGENT_ENGINEERING_QUERY_LIMIT

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

# ---- board helpers (KIND=board, docs/17-executive-team.md §22) --------------

# The agent posts as the repo owner; a card whose newest comment starts with
# this marker is parked, and any later comment from someone else resumes it.
PARKED_MARKER="<!-- $agent:parked -->"

board() { "$script_dir/agent-board.sh" "$agent" "$@"; }

is_parked() {
  gh issue view "$1" --repo "$REPO" --json comments --jq '.comments[-1].body // ""' | grep -qF -- "$PARKED_MARKER"
}

# The cards in <column> that aren't parked, oldest first, at most MAX_CARDS_PER_RUN.
pick_cards() {
  listed=$(board list "$1") || return 1
  picked=0
  printf '%s\n' "$listed" | cut -f1 | sort -n | while IFS= read -r n; do
    [ -n "$n" ] || continue
    [ "$picked" -lt "$MAX_CARDS_PER_RUN" ] || break
    if is_parked "$n"; then
      log "#$n is parked — skipping" >&2
      continue
    fi
    printf '%s\n' "$n"
    picked=$((picked + 1))
  done
}

# A card still in <column> after its session, and not parked, means the
# session died mid-flight. Park it (fail closed); a reply resumes it.
park_if_stuck() {
  [ "$(board show "$1" 2>/dev/null)" = "$2" ] || return 0
  is_parked "$1" && return 0
  log "parking #$1: its session ended (exit $3) with the card still in $2"
  gh issue comment "$1" --repo "$REPO" --body "$PARKED_MARKER
**Parked.** A scheduled run's session for this card ended (exit $3) without moving it on or parking it. Nothing was merged. Reply here to have the next run pick it back up." \
    >/dev/null || log "WARN: could not comment on #$1"
}

# ---- 2. pick the mode --------------------------------------------------------

cards=""
if [ "$KIND" = "operations" ] || [ "$KIND" = "board" ]; then
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
elif [ "$KIND" = "board" ]; then
  command -v jq >/dev/null 2>&1 || die "'jq' not on PATH"
  # K1 (docs/17 §22.11): only specs. BUILD=1 will add the later stages.
  cards=$(pick_cards assigned) || die "could not read the board"
  cards=$(printf '%s' "$cards" | tr '\n' ' ' | sed 's/ *$//')
  if [ -n "$cards" ]; then
    mode=SPEC
    prompt="$PROMPT_SPEC"
  else
    mode=IDLE
  fi
  log "board: assigned cards ${cards:+#}$(printf '%s' "$cards" | sed 's/ / #/g') (max $MAX_CARDS_PER_RUN, BUILD=${BUILD:-0}) → $mode"
elif [ "$count" -ge "$MAX_OPEN_PRS" ]; then
  mode=REVISE
  prompt="$PROMPT_REVISE $prs_before"
  log "open ${BRANCH_PREFIX}* PRs: $count (${prs_before:-none}), limit $MAX_OPEN_PRS → $mode mode"
else
  mode=NEW
  prompt="$PROMPT_NEW"
  log "open ${BRANCH_PREFIX}* PRs: $count (${prs_before:-none}), limit $MAX_OPEN_PRS → $mode mode"
fi

# A manual run's own prompt (see the header); its log line is what the agent monitor tags runs by.
if [ -n "${AGENT_MANUAL:-}" ]; then
  how="scheduled prompt"
  if [ -n "${AGENT_PROMPT:-}" ] && [ "$mode" != "IDLE" ]; then
    if [ "${AGENT_PROMPT_MODE:-append}" = replace ]; then
      prompt=$AGENT_PROMPT
      how="prompt replaced"
    else
      prompt="$prompt

For this run only, from the CEO via the agent monitor: $AGENT_PROMPT"
      how="prompt added"
    fi
  fi
  log "manual run: $how, Team Chat ${AGENT_TEAM_CHAT_ENV:-off}"
fi

# Reports (docs/17 §21.3): this run's folder, by its start in CT, committed after the run.
AGENT_REPORT_DIR=""
if [ -n "${REPORTS:-}" ] && [ "$mode" != "IDLE" ]; then
  AGENT_REPORT_DIR="agent-reports/$(TZ=America/Chicago date +%Y-%m-%d)/$(TZ=America/Chicago date +%H_%M)"
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
  # One session per card for a board run (docs/17 §22.6), each in its own worktree; one session otherwise.
  for card in ${cards:-_}; do
    session_prompt=$prompt
    report="${AGENT_SCHED_LOG%.log}.report.md"
    if [ "$card" != "_" ]; then
      session_prompt="$prompt

Your card: #$card"
      report="${AGENT_SCHED_LOG%.log}.$card.report.md"
      log "--- card #$card"
    fi
    started=$(date +%s)
    "$script_dir/agent-worktree.sh" run "$agent" "$session_prompt" >"$report"
    session_status=$?
    [ "$session_status" -eq 0 ] || status=$session_status
    elapsed=$(( $(date +%s) - started ))
    log "agent exited $session_status after $((elapsed / 60))m$((elapsed % 60))s — final report:"
    cat "$report"
    printf '\n'

    # The agent reports its Team Chat post (docs/17-executive-team.md §11.4); the script never posts itself.
    if [ -n "${AGENT_TEAM_CHAT_ENV:-}" ]; then
      chat_line=$(grep -m1 'Chat post:' "$report" || true)
      if [ -n "$chat_line" ]; then log "team-chat: ${chat_line#*Chat post:}"; else log "WARN: no chat post reported"; fi
    fi

    [ "$card" = "_" ] || park_if_stuck "$card" assigned "$session_status"
  done

  if [ "$KIND" != "operations" ] && [ "$KIND" != "board" ]; then
    prs_after=$(open_prs || echo "?")
    log "open ${BRANCH_PREFIX}* PRs after run: ${prs_after:-none}"
  fi

fi

# Published reports (docs/17 §19.6): copy this agent's committed reports to the website's bucket.
if [ -n "${REPORTS_BUCKET:-}" ] && [ "$mode" != "IDLE" ]; then
  REPORTS_BUCKET=$REPORTS_BUCKET REPORTS_AWS_PROFILE=${REPORTS_AWS_PROFILE:-} \
    "$script_dir/agent-reports-sync.sh" "$agent" 2>&1 | while IFS= read -r line; do log "$line"; done
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
