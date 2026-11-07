#!/bin/sh
#
# agent-memory-commit.sh <agent> <worktree>
#
# Commits an agent's memory folder (docs/17-executive-team.md §17.6)
# straight to main after its run, and nothing else: MEMORY.md plus, for an
# agent with saved queries, queries/<name>.sql (§17.11). Run by
# agent-worktree.sh when AGENT_MEMORY is set. Commits only when something
# changed and every file is within its cap; anything else logs a WARN,
# restores the folder and commits nothing. Never fails the run.

set -u

MEMORY_MAX_BYTES=8192
QUERY_MAX_BYTES=8192
QUERY_MAX_FILES=25

agent=${1:?usage: agent-memory-commit.sh <agent> <worktree>}
dest=${2:?usage: agent-memory-commit.sh <agent> <worktree>}
dir=".claude/agent-memory/$agent"
rel="$dir/MEMORY.md"

say() { printf 'agent-memory: %s\n' "$*" >&2; }
restore() {
  git -C "$dest" checkout -q -- "$dir" 2>/dev/null
  git -C "$dest" clean -q -fd -- "$dir" 2>/dev/null
  [ -n "$(git -C "$dest" ls-files -- "$rel")" ] || rm -f "$dest/$rel"
}
reject() {
  say "WARN: $*; not committing"
  restore
  exit 0
}

if [ -z "$(git -C "$dest" status --porcelain --untracked-files=all -- "$dir")" ]; then
  say "no new memory for $agent"
  exit 0
fi
[ -f "$dest/$rel" ] || reject "$rel was deleted"

size=$(wc -c <"$dest/$rel" | tr -d ' ')
[ "$size" -le "$MEMORY_MAX_BYTES" ] || reject "$rel is $size bytes, over the $MEMORY_MAX_BYTES-byte cap"

# Only MEMORY.md and queries/<lowercase-kebab>.sql may live in the folder.
stray=$(cd "$dest/$dir" && find . -type f ! -path ./MEMORY.md | grep -Ev '^\./queries/[a-z0-9][a-z0-9-]*\.sql$' | head -1)
[ -z "$stray" ] || reject "$dir/${stray#./} is not MEMORY.md or queries/<name>.sql"

count=0
if [ -d "$dest/$dir/queries" ]; then
  for file in "$dest/$dir"/queries/*.sql; do
    [ -f "$file" ] || continue
    count=$((count + 1))
    qsize=$(wc -c <"$file" | tr -d ' ')
    [ "$qsize" -le "$QUERY_MAX_BYTES" ] || reject "$dir/queries/$(basename "$file") is $qsize bytes, over the $QUERY_MAX_BYTES-byte cap"
  done
fi
[ "$count" -le "$QUERY_MAX_FILES" ] || reject "$count saved queries, over the $QUERY_MAX_FILES-file cap"

git -C "$dest" add -A -- "$dir" &&
  git -C "$dest" commit -q -m "[feat] - $agent: Memory update" -- "$dir" || {
  say "WARN: could not commit $dir"
  exit 0
}

for attempt in 1 2; do
  if git -C "$dest" fetch -q origin main && git -C "$dest" rebase -q --autostash origin/main && git -C "$dest" push -q origin HEAD:main; then
    say "memory committed to main ($size bytes, $count saved queries, $(git -C "$dest" rev-parse --short HEAD))"
    exit 0
  fi
  git -C "$dest" rebase --abort 2>/dev/null || true
  say "WARN: memory push attempt $attempt failed"
done
say "WARN: memory not pushed; the commit stays in the kept worktree"
exit 0
