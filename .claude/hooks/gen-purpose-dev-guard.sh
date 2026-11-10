#!/bin/bash
#
# PreToolUse guard for gen-purpose-dev (wired in via that agent's frontmatter
# `hooks:` block, so it is scoped to that subagent only — the user's own
# main-session workflow, which commits straight to main, is unaffected).
#
# Same shape as devx-agent-guard.sh, extended. Blocks:
#   - `git commit` while HEAD is main
#   - any `git push` that targets main (explicit ref, or a bare push from main)
#   - force-pushes and `git reset --hard`
#   - `gh pr merge` / `gh pr close` / `gh issue close` — a human lands and closes
#   - `gh pr create` without `--draft`
#   - any deploy / destroy / bootstrap
#   - raw `gh project` calls and agent-commit-to-main.sh: the board moves only
#     through scripts/agent-board.sh, and only a spec reaches main, through
#     scripts/agent-spec-commit.sh (docs/17-executive-team.md §22)
# The allowlist (.claude/agent-settings/gen-purpose-dev.json) denies most of
# these too; the guard is the half that still holds when the agent is started
# without that file (e.g. as a subagent of an interactive session).
#
# Exit 2 = block and feed the message back to the agent; exit 0 = allow. It
# fails closed: if the command can't be parsed, nothing runs.

input=$(cat)

if ! command -v jq >/dev/null 2>&1; then
  echo "gen-purpose-dev guard: jq is required to inspect commands; refusing to run Bash without it." >&2
  exit 2
fi

cmd=$(printf '%s' "$input" | jq -r '.tool_input.command // ""' 2>/dev/null)
[ -z "$cmd" ] && exit 0

# The hook input's cwd follows the session into a worktree; CLAUDE_PROJECT_DIR
# is the fallback (it stays at the main checkout after EnterWorktree).
dir=$(printf '%s' "$input" | jq -r '.cwd // ""' 2>/dev/null)
[ -z "$dir" ] && dir="${CLAUDE_PROJECT_DIR:-.}"
branch=$(git -C "$dir" branch --show-current 2>/dev/null)

deny() {
  echo "gen-purpose-dev guard: $1" >&2
  exit 2
}

matches() { printf '%s' "$cmd" | grep -qE -- "$1"; }

# `git`, optionally followed by global flags (`-C <path>`, `--no-pager`, ...).
GIT='(^|[^[:alnum:]_-])git([[:space:]]+-C[[:space:]]+[^[:space:]]+|[[:space:]]+-[A-Za-z-]+)*[[:space:]]+'
END='([^[:alnum:]_-]|$)'
BRANCH_HINT="Work on a gen-purpose-dev/<issue-number>-<slug> branch and open a draft PR for human review instead."

if matches "${GIT}push${END}"; then
  if matches '(:|[[:space:]]|refs/heads/)main([[:space:]]|$|["'"'"';&|])'; then
    deny "pushing to main is blocked. $BRANCH_HINT"
  fi
  if [ "$branch" = "main" ]; then
    deny "pushing from the main branch is blocked. $BRANCH_HINT"
  fi
  if matches '[[:space:]](--force|--force-with-lease[^[:space:]]*|-f|\+[^[:space:]]+)([[:space:]]|$)'; then
    deny "force-pushing is blocked — add new commits on top instead."
  fi
fi

if matches "${GIT}commit${END}" && [ "$branch" = "main" ]; then
  deny "committing on main is blocked. $BRANCH_HINT"
fi

if matches "${GIT}reset[[:space:]]+(.*[[:space:]])?--hard${END}"; then
  deny "git reset --hard is blocked."
fi

if matches '(^|[^[:alnum:]_-])gh[[:space:]]+pr[[:space:]]+(merge|close)'"${END}"; then
  deny "merging or closing a PR is a human's call — leave it open."
fi

if matches '(^|[^[:alnum:]_-])gh[[:space:]]+issue[[:space:]]+close'"${END}"; then
  deny "closing an issue is blocked — it closes when a human merges the PR."
fi

if matches '(^|[^[:alnum:]_-])gh[[:space:]]+pr[[:space:]]+create'"${END}" && ! matches '[[:space:]]--draft([[:space:]=]|$)'; then
  deny "PRs must be opened as drafts — add --draft."
fi

if matches '(^|[^[:alnum:]_-])cdk[[:space:]]+(deploy|destroy|bootstrap)'"${END}" \
  || matches 'npm[[:space:]]+run[[:space:]]+deploy'"${END}"; then
  deny "changing real infrastructure is out of scope — describe it on the issue for a human instead."
fi

if matches '(^|[^[:alnum:]_-])gh[[:space:]]+(project|api[[:space:]]+graphql)'"${END}"; then
  deny "move cards only with scripts/agent-board.sh gen-purpose-dev move <issue> <column>."
fi

if matches 'agent-commit-to-main\.sh'; then
  deny "only your spec goes straight to main, with scripts/agent-spec-commit.sh <issue>."
fi

exit 0
