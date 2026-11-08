#!/bin/sh
#
# agent-commit-to-main.sh <worktree> <message> <path>...
#
# Commits the working-tree state of <path>... in <worktree> as one commit on
# top of origin/main and pushes it, without touching the worktree's HEAD,
# branch or index (docs/17-executive-team.md §17.6, §21.3). A run that ends
# on a PR branch (Grimble's cost/<n>) therefore never pushes that branch's
# commits to main. Builds the commit in a temporary index, so only the
# named paths change. On success, restores those paths in the worktree to
# its HEAD (their content is now on main), so a clean run's worktree is
# removed. Exit 0 pushed, 1 nothing to commit, 2 failed.

set -u

dest=${1:?usage: agent-commit-to-main.sh <worktree> <message> <path>...}
message=${2:?usage: agent-commit-to-main.sh <worktree> <message> <path>...}
shift 2
[ "$#" -gt 0 ] || { printf 'agent-commit-to-main: no paths\n' >&2; exit 2; }

index=$(mktemp) || exit 2
trap 'rm -f "$index"' EXIT INT TERM

attempt=0
while [ "$attempt" -lt 3 ]; do
  attempt=$((attempt + 1))
  git -C "$dest" fetch -q origin main || { sleep 2; continue; }
  base=$(git -C "$dest" rev-parse origin/main) || exit 2
  rm -f "$index"
  GIT_INDEX_FILE=$index git -C "$dest" read-tree "$base" || exit 2
  GIT_INDEX_FILE=$index git -C "$dest" add -A -- "$@" || exit 2
  tree=$(GIT_INDEX_FILE=$index git -C "$dest" write-tree) || exit 2
  if [ "$tree" = "$(git -C "$dest" rev-parse "$base^{tree}")" ]; then
    printf 'agent-commit-to-main: nothing new against origin/main\n' >&2
    exit 1
  fi
  commit=$(git -C "$dest" commit-tree "$tree" -p "$base" -m "$message") || exit 2
  if git -C "$dest" push -q origin "$commit:refs/heads/main"; then
    for path in "$@"; do
      git -C "$dest" checkout -q HEAD -- "$path" 2>/dev/null
      git -C "$dest" clean -q -fd -- "$path" 2>/dev/null
    done
    printf '%s\n' "$commit"
    exit 0
  fi
  printf 'agent-commit-to-main: push attempt %s rejected; retrying on the new origin/main\n' "$attempt" >&2
done
exit 2
