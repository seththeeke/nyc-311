#!/bin/bash
#
# PreToolUse guard shared by every agent with Bash (wired in through each
# agent's frontmatter): the `ceo-approved` label is the CEO's alone
# (docs/17-executive-team.md §22.1). It is what lets Kid Kestrel build past
# Spec Created, so no agent may add it, remove it or create it. Reading it
# (gh issue view/list, gh search, grep) stays allowed; any gh write or API call
# that names it is blocked. agent-board.sh clears it on a move to Intake from
# its own process, which this guard never sees.
#
# Exit 2 = block and feed the message back to the agent; exit 0 = allow.

input=$(cat)

if ! command -v jq >/dev/null 2>&1; then
  echo "ceo-approval guard: jq is required to inspect commands; refusing to run Bash without it." >&2
  exit 2
fi

cmd=$(printf '%s' "$input" | jq -r '.tool_input.command // ""' 2>/dev/null)
[ -z "$cmd" ] && exit 0

printf '%s' "$cmd" | grep -qi 'ceo-approved' || exit 0

if printf '%s' "$cmd" | grep -qiE '(^|[^[:alnum:]_-])gh[[:space:]]+((issue|pr)[[:space:]]+(edit|create)|label|api)([^[:alnum:]_-]|$)|graphql|curl|wget'; then
  echo "ceo-approval guard: the ceo-approved label is the CEO's alone; no agent adds, removes or creates it. Ask @Seth on the ticket instead." >&2
  exit 2
fi

exit 0
