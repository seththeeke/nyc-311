#!/bin/bash
#
# PreToolUse / Bash hook (registered in .claude/settings.json, so it applies to
# the main session AND every subagent). Its job: right before any `git commit`
# runs, record WHICH agent is committing so the repo's prepare-commit-msg git
# hook can prefix the message with that agent's name.
#
# Mechanism:
#   - Claude Code passes `agent_type` on stdin only when the tool call fires
#     inside a subagent (e.g. "devx-agent"). Absent => the main session.
#   - We write "<name> <epoch>" to <git-dir>/CLAUDE_COMMITTER. The git hook
#     reads it, checks freshness, and prepends "<name>: " to the commit
#     message. A commit made outside Claude Code leaves no stamp => no prefix.
#
# Never blocks: every path exits 0. A failure here must not stop a commit.

input=$(cat)

cmd=$(printf '%s' "$input" | jq -r '.tool_input.command // ""' 2>/dev/null)
printf '%s' "$cmd" | grep -qE '(^|[^[:alnum:]_-])git([[:space:]]+-[A-Za-z-]+|[[:space:]]+-C[[:space:]]+[^[:space:]]+)*[[:space:]]+commit([^[:alnum:]_-]|$)' || exit 0

name=$(printf '%s' "$input" | jq -r '.agent_type // "claude-default-agent"' 2>/dev/null)
[ -z "$name" ] || [ "$name" = "null" ] && name="claude-default-agent"

project_dir="$(printf '%s' "$input" | jq -r '.cwd // ""' 2>/dev/null)"
[ -z "$project_dir" ] && project_dir="${CLAUDE_PROJECT_DIR:-.}"

stamp_path=$(git -C "$project_dir" rev-parse --git-path CLAUDE_COMMITTER 2>/dev/null)
[ -z "$stamp_path" ] && exit 0
case "$stamp_path" in
  /*) : ;;
  *) stamp_path="$project_dir/$stamp_path" ;;
esac

printf '%s %s\n' "$name" "$(date +%s)" > "$stamp_path" 2>/dev/null

# Self-heal: make sure the repo's prepare-commit-msg hook is actually active.
# core.hooksPath is local config (not committed), so a fresh clone won't have
# it until something sets it. Only set it when unset, to respect a deliberate
# override.
if [ -z "$(git -C "$project_dir" config --local --get core.hooksPath 2>/dev/null)" ]; then
  git -C "$project_dir" config --local core.hooksPath .githooks 2>/dev/null
fi

exit 0
