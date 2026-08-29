#!/bin/bash
#
# PreToolUse guard for the devx-agent (wired in via that agent's frontmatter
# `hooks:` block, so it is scoped to that subagent only — the user's own
# main-session workflow, which commits straight to main, is unaffected).
#
# Blocks the devx-agent from landing anything on main directly: no `git commit`
# while HEAD is main, and no `git push` that targets main (explicit ref or a
# bare push from the main branch). Exit 2 = block and feed the message back to
# the agent; exit 0 = allow.

input=$(cat)

cmd=$(printf '%s' "$input" | python3 -c 'import sys, json
try:
    print(json.load(sys.stdin).get("tool_input", {}).get("command", ""))
except Exception:
    print("")
' 2>/dev/null)

[ -z "$cmd" ] && exit 0

branch=$(git -C "${CLAUDE_PROJECT_DIR:-.}" branch --show-current 2>/dev/null)

deny() {
  echo "devx-agent guard: $1 Create a devx/<issue-number> branch and open a PR for human review instead." >&2
  exit 2
}

if printf '%s' "$cmd" | grep -qE '(^|[^[:alnum:]_-])git[[:space:]]+push([^[:alnum:]_-]|$)'; then
  if printf '%s' "$cmd" | grep -qE '(:|[[:space:]])main([[:space:]]|$|["'"'"'])' \
    || printf '%s' "$cmd" | grep -qE 'HEAD:main'; then
    deny "pushing to main is blocked."
  fi
  if [ "$branch" = "main" ]; then
    deny "pushing from the main branch is blocked."
  fi
fi

if printf '%s' "$cmd" | grep -qE '(^|[^[:alnum:]_-])git[[:space:]]+commit([^[:alnum:]_-]|$)' \
  && [ "$branch" = "main" ]; then
  deny "committing on main is blocked."
fi

exit 0
