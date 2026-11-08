#!/bin/bash
#
# PreToolUse guard for the aws-cost-agent (docs/17-executive-team.md §18),
# wired in through the agent's frontmatter. Like Pip's: no commit on main, no
# push to main, no merge, never the admin AWS profile. Also: files are added
# by name, never `git add -A` / `.` / `--all`, and never the agent's memory
# or reports, which are committed to main after the run, not into a PR.
# Exit 2 blocks.

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
  echo "aws-cost-agent guard: $1" >&2
  exit 2
}

if printf '%s' "$cmd" | grep -qE -- '--profile[= ]nyc311([[:space:]]|$|["'"'"'])'; then
  deny "the admin nyc311 profile is blocked. Use --profile nyc311-aws-cost-agent (read-only)."
fi

if printf '%s' "$cmd" | grep -qE '(^|[^[:alnum:]_-])gh[[:space:]]+pr[[:space:]]+(merge|close)([^[:alnum:]_-]|$)' \
  || printf '%s' "$cmd" | grep -qE 'pulls/[0-9]+/merge'; then
  deny "merging or closing a PR is blocked. Seth merges cost/ PRs."
fi

if printf '%s' "$cmd" | grep -qE '(^|[^[:alnum:]_-])git[[:space:]]+add([^[:alnum:]_-]|$)'; then
  if printf '%s' "$cmd" | grep -qE 'git[[:space:]]+add[[:space:]]+([^;&|]*[[:space:]])?(-A|--all|-u|--update|\.|\./?|:/)([[:space:]]|$|;|&)'; then
    deny "add files by name; git add -A, -u, --all and . are blocked so memory and reports never land in a PR."
  fi
  if printf '%s' "$cmd" | grep -qE '\.claude/agent-(memory|reports)'; then
    deny "your memory and reports are committed to main after the run; never add them to a PR."
  fi
fi

if printf '%s' "$cmd" | grep -qE '(^|[^[:alnum:]_-])git[[:space:]]+push([^[:alnum:]_-]|$)'; then
  if printf '%s' "$cmd" | grep -qE '(:|[[:space:]])main([[:space:]]|$|["'"'"'])' \
    || printf '%s' "$cmd" | grep -qE 'HEAD:main'; then
    deny "pushing to main is blocked. Push your cost/<issue> branch and open a PR."
  fi
  if printf '%s' "$cmd" | grep -qE -- '(^|[[:space:]])(-f|--force|--force-with-lease)([[:space:]=]|$)'; then
    deny "force-pushing is blocked."
  fi
  [ "$branch" = "main" ] && deny "pushing from the main branch is blocked."
fi

if printf '%s' "$cmd" | grep -qE '(^|[^[:alnum:]_-])git[[:space:]]+(commit|revert|merge)([^[:alnum:]_-]|$)' \
  && [ "$branch" = "main" ]; then
  deny "committing on main is blocked. Branch off origin/main as cost/<issue>-<slug> first."
fi

exit 0
