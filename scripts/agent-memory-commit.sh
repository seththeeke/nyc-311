#!/bin/sh
#
# agent-memory-commit.sh <agent> <worktree>
#
# Commits an agent's memory file (docs/17-executive-team.md §17.6) straight
# to main after its run, and nothing else. Run by agent-worktree.sh when
# AGENT_MEMORY is set. Commits only when the file changed and is within the
# cap; anything else logs a WARN and commits nothing. Never fails the run.

set -u

MEMORY_MAX_BYTES=8192

agent=${1:?usage: agent-memory-commit.sh <agent> <worktree>}
dest=${2:?usage: agent-memory-commit.sh <agent> <worktree>}
rel=".claude/agent-memory/$agent/MEMORY.md"

say() { printf 'agent-memory: %s\n' "$*" >&2; }
restore() { git -C "$dest" checkout -q -- "$rel" 2>/dev/null || rm -f "$dest/$rel"; }

if [ -z "$(git -C "$dest" status --porcelain -- "$rel")" ]; then
  say "no new memory for $agent"
  exit 0
fi
if [ ! -f "$dest/$rel" ]; then
  say "WARN: $rel was deleted; not committing"
  restore
  exit 0
fi
size=$(wc -c <"$dest/$rel" | tr -d ' ')
if [ "$size" -gt "$MEMORY_MAX_BYTES" ]; then
  say "WARN: $rel is $size bytes, over the $MEMORY_MAX_BYTES-byte cap; not committing"
  restore
  exit 0
fi

git -C "$dest" add -- "$rel" &&
  git -C "$dest" commit -q -m "[feat] - $agent: Memory update" -- "$rel" || {
  say "WARN: could not commit $rel"
  exit 0
}

for attempt in 1 2; do
  if git -C "$dest" fetch -q origin main && git -C "$dest" rebase -q --autostash origin/main && git -C "$dest" push -q origin HEAD:main; then
    say "memory committed to main ($size bytes, $(git -C "$dest" rev-parse --short HEAD))"
    exit 0
  fi
  git -C "$dest" rebase --abort 2>/dev/null || true
  say "WARN: memory push attempt $attempt failed"
done
say "WARN: memory not pushed; the commit stays in the kept worktree"
exit 0
