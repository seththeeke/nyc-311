#!/bin/sh
#
# agent-report-commit.sh <agent> <worktree> <report-dir>
#
# Commits the reports an agent wrote this run (docs/17-executive-team.md
# §21.3) straight to main, and nothing else. Run by agent-worktree.sh when
# AGENT_REPORT_DIR is set (REPORTS=1 in the agent's schedule). Accepts only
# new files in <report-dir> named <agent>-<name>.md, each within the word
# and byte caps. Anything else under .claude/agent-reports/ logs a WARN, is
# restored, and nothing is committed. Never fails the run.

set -u

REPORT_MAX_WORDS=500
REPORT_MAX_BYTES=8192
REPORT_MAX_FILES=5
ROOT=".claude/agent-reports"

agent=${1:?usage: agent-report-commit.sh <agent> <worktree> <report-dir>}
dest=${2:?usage: agent-report-commit.sh <agent> <worktree> <report-dir>}
dir=${3:?usage: agent-report-commit.sh <agent> <worktree> <report-dir>}

say() { printf 'agent-report: %s\n' "$*" >&2; }
restore() {
  git -C "$dest" checkout -q -- "$ROOT" 2>/dev/null
  git -C "$dest" clean -q -fd -- "$ROOT" 2>/dev/null
}
reject() {
  say "WARN: $*; not committing"
  restore
  exit 0
}

case "$dir" in
  "$ROOT"/[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]/[0-2][0-9]_[0-5][0-9]) : ;;
  *) reject "report dir '$dir' is not $ROOT/<YYYY-MM-DD>/<HH_MM>" ;;
esac

changes=$(git -C "$dest" status --porcelain --untracked-files=all -- "$ROOT")
if [ -z "$changes" ]; then
  say "no new reports for $agent"
  exit 0
fi

count=0
words_total=0
# Every change must be a new, untracked file in this run's folder, named for this agent.
while IFS= read -r line; do
  [ -n "$line" ] || continue
  code=${line%% *}
  path=${line#?? }
  [ "$code" = "??" ] || reject "$path was changed or deleted; reports are add-only"
  name=${path#"$dir"/}
  [ "$name" != "$path" ] || reject "$path is outside this run's folder $dir"
  case "$name" in
    */*) reject "$path is in a subfolder" ;;
    "$agent"-*.md) : ;;
    *) reject "$path is not named $agent-<name>.md" ;;
  esac
  slug=${name#"$agent"-}
  slug=${slug%.md}
  case "$slug" in
    '' | -* | *[!a-z0-9-]*) reject "$path: the name after '$agent-' must be lowercase-kebab" ;;
  esac
  file="$dest/$path"
  bytes=$(wc -c <"$file" | tr -d ' ')
  [ "$bytes" -le "$REPORT_MAX_BYTES" ] || reject "$path is $bytes bytes, over the $REPORT_MAX_BYTES-byte cap"
  words=$(wc -w <"$file" | tr -d ' ')
  [ "$words" -le "$REPORT_MAX_WORDS" ] || reject "$path is $words words, over the $REPORT_MAX_WORDS-word cap"
  count=$((count + 1))
  words_total=$((words_total + words))
done <<EOF
$changes
EOF
[ "$count" -le "$REPORT_MAX_FILES" ] || reject "$count reports, over the $REPORT_MAX_FILES-file cap"

# Commit on top of origin/main, never on the run's own branch (a PR branch for a pr-limit agent).
if sha=$("$(dirname -- "$0")/agent-commit-to-main.sh" "$dest" "[feat] - $agent: Report ${dir#"$ROOT"/}" "$dir"); then
  say "$count report(s) committed to main ($words_total words, $(printf '%.7s' "$sha"))"
  exit 0
fi
say "WARN: reports not pushed; they stay in the kept worktree"
exit 0
