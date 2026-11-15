#!/bin/sh
#
# agent-board.sh — the one way agents read and move cards on the Kid Kestral
# project board (docs/17-executive-team.md §22.1). Every card is an issue in
# seththeeke/nyc-311; its column is the board's Status field. Like
# agent-issue-state.sh before it, one script owns every move, so an agent's
# prompt and the scheduler can't disagree about what a column means, and an
# agent can only make the moves its row in the table below allows.
#
#   agent-board.sh <agent> list [<column>]      issue<TAB>column<TAB>title per card
#   agent-board.sh <agent> show <issue>         the issue's column, or "none"
#   agent-board.sh <agent> add <issue>          put an issue on the board, in Intake
#   agent-board.sh <agent> move <issue> <column>
#
# Columns, by key: intake, refined, assigned, spec-created, in-development,
# verified-test, verified-prod, verified-team, ceo-intervention.
#
# Moves each agent may make (anything else is refused; same column → no-op):
#   cpo-agent        add (→ intake); intake → refined; refined → intake
#   cto-agent        intake → refined; refined → intake
#   gen-purpose-dev  assigned → spec-created; assigned | spec-created → intake;
#                    spec-created → in-development → verified-test → verified-prod;
#                    in-development | verified-test | verified-prod → ceo-intervention
# Into refined, the issue must carry both `cpo-approved` and `cto-approved`
# (§22.2.1). Into spec-created, its spec must be on origin/main at
# docs/kid-kestral/<issue>-<slug>.md (§22.3). Every gen-purpose-dev move out
# of spec-created onward needs the CEO's `ceo-approved` label (§22.1), and an
# approved card never goes back to intake: its way out is ceo-intervention.
# Into in-development from spec-created, the column must hold fewer than
# WIP_LIMIT cards (default 5). Into intake, every approval label is cleared,
# so a card sent back is refined and approved again. The CEO moves cards by
# hand, including every move out of ceo-intervention.
#
# Needs gh with the `project` scope (gh auth refresh -h github.com -s project).

set -eu

REPO=${AGENT_REPO:-seththeeke/nyc-311}
OWNER=${AGENT_BOARD_OWNER:-seththeeke}
NUMBER=${AGENT_BOARD_NUMBER:-3}
SPEC_DIR=docs/kid-kestral
WIP_LIMIT=${WIP_LIMIT:-5}

die() { printf 'agent-board: %s\n' "$*" >&2; exit 1; }
usage() { die "usage: agent-board.sh <agent> {list [<column>] | show <issue> | add <issue> | move <issue> <column>}"; }

agent=${1:-}
cmd=${2:-}
[ -n "$agent" ] && [ -n "$cmd" ] || usage
shift 2

column_name() {
  case "$1" in
    intake) echo "Intake" ;;
    refined) echo "Refined" ;;
    assigned) echo "Assigned" ;;
    spec-created) echo "Spec Created" ;;
    in-development) echo "In Development" ;;
    verified-test) echo "Verified in Test Environment" ;;
    verified-prod) echo "Verified in Production Environment" ;;
    verified-team) echo "Verified by Team" ;;
    ceo-intervention) echo "Requires CEO Intervention" ;;
    *) die "unknown column '$1' (intake | refined | assigned | spec-created | in-development | verified-test | verified-prod | verified-team | ceo-intervention)" ;;
  esac
}

column_key() {
  case "$1" in
    "Intake") echo intake ;;
    "Refined") echo refined ;;
    "Assigned") echo assigned ;;
    "Spec Created") echo spec-created ;;
    "In Development") echo in-development ;;
    "Verified in Test Environment") echo verified-test ;;
    "Verified in Production Environment") echo verified-prod ;;
    "Verified by Team") echo verified-team ;;
    "Requires CEO Intervention") echo ceo-intervention ;;
    "") echo none ;;
    *) echo unknown ;;
  esac
}

is_issue() { case "$1" in '' | *[!0-9]*) die "not an issue number: '$1'" ;; esac; }

# Every card on the board as JSON lines: {item, number, status, title}, this repo's issues only.
cards() {
  gh project item-list "$NUMBER" --owner "$OWNER" --format json --limit 500 |
    jq -c --arg repo "https://github.com/$REPO" '.items[]
      | select(.content.type == "Issue" and (.content.url // "" | startswith($repo + "/issues/")))
      | {item: .id, number: .content.number, status: (.status // ""), title: .content.title}'
}

card_for() { cards | jq -c --argjson n "$1" 'select(.number == $n)' | head -n 1; }

allowed() {
  case "$agent:$1:$2" in
    cpo-agent:intake:refined | cpo-agent:refined:intake) return 0 ;;
    cto-agent:intake:refined | cto-agent:refined:intake) return 0 ;;
    gen-purpose-dev:assigned:spec-created) return 0 ;;
    gen-purpose-dev:assigned:intake | gen-purpose-dev:spec-created:intake) return 0 ;;
    gen-purpose-dev:spec-created:in-development | gen-purpose-dev:in-development:verified-test) return 0 ;;
    gen-purpose-dev:verified-test:verified-prod) return 0 ;;
    gen-purpose-dev:in-development:ceo-intervention | gen-purpose-dev:verified-test:ceo-intervention) return 0 ;;
    gen-purpose-dev:verified-prod:ceo-intervention) return 0 ;;
  esac
  return 1
}

set_status() {
  project_id=$(gh project view "$NUMBER" --owner "$OWNER" --format json --jq .id)
  field=$(gh project field-list "$NUMBER" --owner "$OWNER" --format json |
    jq -c '.fields[] | select(.name == "Status")')
  field_id=$(printf '%s' "$field" | jq -r .id)
  option_id=$(printf '%s' "$field" | jq -r --arg name "$2" '.options[] | select(.name == $name) | .id')
  [ -n "$field_id" ] && [ -n "$option_id" ] || die "the board has no Status option '$2'"
  gh project item-edit --id "$1" --project-id "$project_id" --field-id "$field_id" --single-select-option-id "$option_id" >/dev/null
}

labels_of() { gh issue view "$1" --repo "$REPO" --json labels --jq '[.labels[].name] | join(" ")'; }

has_label() { case " $1 " in *" $2 "*) return 0 ;; esac; return 1; }

# The CEO's go-ahead (§22.1): Kestrel moves an approved card only with it, and never back to intake.
check_ceo_approval() {
  [ "$agent" = gen-purpose-dev ] || return 0
  labels=$(labels_of "$1") || die "could not read #$1's labels"
  case "$2:$3" in
    *:intake)
      ! has_label "$labels" ceo-approved ||
        die "#$1 is ceo-approved: it can't go back to intake; move it to ceo-intervention with a comment instead" ;;
    spec-created:* | in-development:* | verified-test:* | verified-prod:*)
      has_label "$labels" ceo-approved ||
        die "#$1 needs the CEO's ceo-approved label before it moves past Spec Created" ;;
  esac
}

check_entry() {
  issue=$1
  case "$2" in
    refined)
      labels=$(labels_of "$issue")
      for need in cpo-approved cto-approved; do
        has_label "$labels" "$need" || die "#$issue needs both cpo-approved and cto-approved to enter Refined (missing $need)"
      done ;;
    in-development)
      [ "${3:-}" = spec-created ] || return 0
      wip=$(cards | jq -s '[.[] | select(.status == "In Development")] | length')
      [ "$wip" -lt "$WIP_LIMIT" ] ||
        die "In Development already holds $wip cards (limit $WIP_LIMIT); #$issue waits in Spec Created" ;;
    spec-created)
      git fetch -q origin main 2>/dev/null || die "could not fetch origin/main to check the spec"
      git ls-tree --name-only origin/main "$SPEC_DIR/" | grep -q "^$SPEC_DIR/$issue-[a-z0-9-]*\.md$" ||
        die "#$issue has no spec on origin/main at $SPEC_DIR/$issue-<slug>.md; commit it with scripts/agent-spec-commit.sh first" ;;
  esac
}

case "$cmd" in
  list)
    filter=""
    [ "$#" -ge 1 ] && filter=$(column_name "$1")
    cards | jq -r --arg f "$filter" 'select($f == "" or .status == $f) | [(.number | tostring), .status, .title] | @tsv' |
      while IFS='	' read -r n status title; do
        printf '%s\t%s\t%s\n' "$n" "$(column_key "$status")" "$title"
      done ;;
  show)
    is_issue "${1:-}"
    card=$(card_for "$1")
    if [ -z "$card" ]; then echo none; else column_key "$(printf '%s' "$card" | jq -r .status)"; fi ;;
  add)
    is_issue "${1:-}"
    [ "$agent" = cpo-agent ] || die "$agent may not add cards; Celestine files to Intake"
    [ -z "$(card_for "$1")" ] || { echo "#$1 is already on the board"; exit 0; }
    item=$(gh project item-add "$NUMBER" --owner "$OWNER" --url "https://github.com/$REPO/issues/$1" --format json --jq .id)
    set_status "$item" "Intake"
    echo "#$1 added to intake" ;;
  move)
    is_issue "${1:-}"
    [ "$#" -ge 2 ] || usage
    to_name=$(column_name "$2")
    card=$(card_for "$1")
    [ -n "$card" ] || die "#$1 is not on the board"
    from=$(column_key "$(printf '%s' "$card" | jq -r .status)")
    [ "$from" != "$2" ] || { echo "#$1 is already in $2"; exit 0; }
    allowed "$from" "$2" || die "$agent may not move #$1 from $from to $2"
    check_ceo_approval "$1" "$from" "$2"
    check_entry "$1" "$2" "$from"
    set_status "$(printf '%s' "$card" | jq -r .item)" "$to_name"
    if [ "$2" = intake ]; then
      gh issue edit "$1" --repo "$REPO" --remove-label cpo-approved --remove-label cto-approved --remove-label ceo-approved >/dev/null 2>&1 ||
        printf 'agent-board: WARN: could not clear the approval labels on #%s\n' "$1" >&2
    fi
    echo "#$1 moved $from → $2" ;;
  *) usage ;;
esac
