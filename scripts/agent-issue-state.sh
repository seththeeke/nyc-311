#!/bin/sh
#
# agent-issue-state.sh — the label state machine for agents that work
# explicitly-assigned GitHub issues (gen-purpose-dev today). One place owns
# every transition, so the scheduled-run wrapper and the agent itself can't
# disagree about what a label means. docs/agent-automation-setup.md is the
# write-up.
#
#   agent-issue-state.sh <agent> ensure-labels     create any missing labels
#   agent-issue-state.sh <agent> <issue> show      print the issue's state
#   agent-issue-state.sh <agent> <issue> <state>   move the issue to <state>
#
# Assignment is the label named after the agent (e.g. `gen-purpose-dev`) — a
# human applies it, nothing here ever does. An issue without it is refused: an
# agent cannot move (and so cannot claim) work it wasn't given.
#
# States, and the labels that carry them:
#   todo         (assignment label only)      assigned, not yet claimed
#   planning     agent-planning               claimed; plan being written
#   in-progress  agent-in-progress            plan posted; code under way
#   pr-review    agent-pr-review              draft PR open; waiting on a human
#   needs-info   agent-blocked + needs-info   parked on a question for a human
#   blocked      agent-blocked                parked after a failed/aborted run
#   done         agent-done                   issue closed (set by the wrapper)
#
# Allowed moves (anything else is refused; same state → no-op):
#   todo        → planning
#   planning    → in-progress | needs-info | blocked | todo
#   in-progress → pr-review | needs-info | blocked
#   needs-info  → planning | in-progress | todo
#   blocked     → planning | in-progress | todo
#   pr-review   → in-progress | needs-info | blocked | done
# `done` additionally requires the issue to be closed, and a closed issue can
# only move to `done` — the agent never closes an issue, a merged PR does.

set -eu

REPO=${AGENT_REPO:-seththeeke/nyc-311}
STATE_LABELS='agent-planning agent-in-progress agent-pr-review agent-blocked agent-done needs-info'

die() { printf 'agent-issue-state: %s\n' "$*" >&2; exit 1; }
usage() { die "usage: agent-issue-state.sh <agent> {ensure-labels | <issue> show | <issue> <state>}"; }

agent=${1:-}
[ -n "$agent" ] || usage
shift

ensure_labels() {
  existing=$(gh label list --repo "$REPO" --limit 200 --json name --jq '.[].name')
  while IFS='|' read -r name color desc; do
    [ -n "$name" ] || continue
    printf '%s\n' "$existing" | grep -qxF -- "$name" && continue
    gh label create "$name" --repo "$REPO" --color "$color" --description "$desc" >/dev/null
    printf 'agent-issue-state: created label %s\n' "$name" >&2
  done <<EOF
$agent|1D76DB|Assigned to $agent — it works only issues carrying this label
agent-planning|FBCA04|Agent has claimed the issue and is writing its plan
agent-in-progress|0E8A16|Agent has posted its plan and is making the change
agent-pr-review|5319E7|Agent opened a draft PR; waiting on human review
agent-blocked|D93F0B|Agent is parked; a human reply on the issue resumes it
agent-done|CCCCCC|Agent-worked issue that has been closed
needs-info|D876E3|Agent asked a question it cannot answer itself
EOF
}

if [ "${1:-}" = "ensure-labels" ]; then
  ensure_labels
  exit 0
fi

issue=${1:-}
target=${2:-}
[ -n "$issue" ] && [ -n "$target" ] || usage
issue=${issue#\#}
case "$issue" in '' | *[!0-9]*) die "bad issue number: '$issue'" ;; esac

info=$(gh issue view "$issue" --repo "$REPO" --json state,labels --jq '.state, .labels[].name') \
  || die "could not read #$issue"
issue_state=$(printf '%s\n' "$info" | sed -n 1p)
names=$(printf '%s\n' "$info" | sed 1d)
has() { printf '%s\n' "$names" | grep -qxF -- "$1"; }

has "$agent" || die "#$issue does not carry the '$agent' label — not assigned to $agent, refusing"

if has agent-done; then current=done
elif has agent-pr-review; then current=pr-review
elif has agent-blocked && has needs-info; then current=needs-info
elif has agent-blocked; then current=blocked
elif has agent-in-progress; then current=in-progress
elif has agent-planning; then current=planning
else current=todo
fi

if [ "$target" = "show" ]; then
  printf '%s\n' "$current"
  exit 0
fi

case "$target" in
  todo) want='' ;;
  planning) want='agent-planning' ;;
  in-progress) want='agent-in-progress' ;;
  pr-review) want='agent-pr-review' ;;
  needs-info) want='agent-blocked needs-info' ;;
  blocked) want='agent-blocked' ;;
  done) want='agent-done' ;;
  *) die "unknown state '$target' (todo planning in-progress pr-review needs-info blocked done)" ;;
esac

if [ "$current" = "$target" ]; then
  printf '#%s: already %s\n' "$issue" "$current"
  exit 0
fi

if [ "$issue_state" != "OPEN" ] && [ "$target" != "done" ]; then
  die "#$issue is $issue_state — a closed issue can only move to 'done'"
fi

if [ "$target" = "done" ]; then
  [ "$issue_state" != "OPEN" ] || die "#$issue is still open — 'done' is only for closed issues"
else
  case "$current:$target" in
    todo:planning) : ;;
    planning:in-progress | planning:needs-info | planning:blocked | planning:todo) : ;;
    in-progress:pr-review | in-progress:needs-info | in-progress:blocked) : ;;
    needs-info:planning | needs-info:in-progress | needs-info:todo) : ;;
    blocked:planning | blocked:in-progress | blocked:todo) : ;;
    pr-review:in-progress | pr-review:needs-info | pr-review:blocked) : ;;
    *) die "#$issue: $current → $target is not an allowed transition" ;;
  esac
fi

ensure_labels

add=''
for l in $want; do
  has "$l" || add="${add:+$add,}$l"
done
remove=''
for l in $STATE_LABELS; do
  has "$l" || continue
  case " $want " in *" $l "*) continue ;; esac
  remove="${remove:+$remove,}$l"
done

set -- "$issue" --repo "$REPO"
[ -z "$add" ] || set -- "$@" --add-label "$add"
[ -z "$remove" ] || set -- "$@" --remove-label "$remove"
gh issue edit "$@" >/dev/null || die "gh issue edit failed for #$issue"

printf '#%s: %s → %s\n' "$issue" "$current" "$target"
