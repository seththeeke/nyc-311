#!/bin/sh
#
# devx-worktree.sh — per-agent git-worktree isolation for parallel autonomous
# devx-agent runs (docs/autonomous-agent-plan.md).
#
# A git worktree shares one .git object store and ref namespace but has its own
# working tree, index, and HEAD — the isolation needed to run 10-15 agents at
# once without their `git add` / `git commit` / `git checkout` colliding.
# node_modules is populated by an APFS copy-on-write clone (`cp -c`) so it costs
# near-zero disk and only diverges from the primary on write.
#
# Subcommands:
#   new [name]     create a worktree at origin/main (detached HEAD), print its path
#   rm <name|path> remove a worktree; its branch is left intact for the PR
#   ls             list devx worktrees with branch + dirty-file count
#
# Worktrees live in a sibling dir ../nyc-311-worktrees/<name> (override with
# DEVX_WORKTREE_ROOT) — outside the repo, so no tool/glob recursion or
# nested-repo edge cases.
#
# NOTE: the plan specified `flock` to serialize the `fetch`; macOS ships no
# flock, so `new` uses an atomic `mkdir` lock with the same effect.

set -eu

script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
PRIMARY=$(git -C "$script_dir" rev-parse --show-toplevel)
DEVX_WORKTREE_ROOT=${DEVX_WORKTREE_ROOT:-"$(dirname -- "$PRIMARY")/nyc-311-worktrees"}
LOCK_DIR="$DEVX_WORKTREE_ROOT/.devx-worktree.lock"

# gitignored-but-required files to copy into each worktree (relative to repo root).
# Without settings.local.json a headless `-p` run prompts on nearly every tool call.
# Root .env is personal notes only — not copied.
COPY_UNTRACKED='.claude/settings.local.json
web-app/.env.local'

# Packages whose node_modules get CoW-cloned.
NODE_PKGS='. web-app backend cdk'

die() { printf 'devx-worktree: %s\n' "$*" >&2; exit 1; }

cmd_new() {
  name=${1:-}
  if [ -z "$name" ]; then
    rand=$(od -An -N2 -tx1 /dev/urandom | tr -d ' \n')
    name="run-$(date +%s)-$rand"
  fi
  case "$name" in
    */* | .* | '') die "invalid worktree name: '$name'" ;;
  esac
  dest="$DEVX_WORKTREE_ROOT/$name"
  [ -e "$dest" ] && die "worktree path already exists: $dest"

  mkdir -p "$DEVX_WORKTREE_ROOT"

  # Serialize the ref update against overlapping `new` calls (atomic mkdir lock).
  i=0
  while ! mkdir "$LOCK_DIR" 2>/dev/null; do
    i=$((i + 1))
    [ "$i" -gt 120 ] && die "could not acquire $LOCK_DIR after 120s — stale? remove it by hand"
    sleep 1
  done
  trap 'rmdir "$LOCK_DIR" 2>/dev/null || true' EXIT INT TERM

  if ! git -C "$PRIMARY" fetch --quiet origin main; then
    sleep 2
    git -C "$PRIMARY" fetch --quiet origin main || die "git fetch origin main failed"
  fi
  git -C "$PRIMARY" worktree add --detach "$dest" origin/main >&2

  rmdir "$LOCK_DIR" 2>/dev/null || true
  trap - EXIT INT TERM

  for pkg in $NODE_PKGS; do
    src="$PRIMARY/$pkg/node_modules"
    [ -d "$src" ] || continue
    cp -c -R "$src" "$dest/$pkg/node_modules" \
      || die "cp -c failed for $pkg/node_modules (APFS copy-on-write required)"
  done

  printf '%s\n' "$COPY_UNTRACKED" | while IFS= read -r rel; do
    [ -n "$rel" ] || continue
    if [ -f "$PRIMARY/$rel" ]; then
      mkdir -p "$dest/$(dirname -- "$rel")"
      cp "$PRIMARY/$rel" "$dest/$rel"
    else
      printf 'devx-worktree: note: %s absent in primary, not copied\n' "$rel" >&2
    fi
  done

  printf '%s\n' "$dest"
}

cmd_rm() {
  [ "$#" -ge 1 ] || die "usage: devx-worktree.sh rm <name|path>"
  case "$1" in
    /*) raw="$1" ;;
    *) raw="$DEVX_WORKTREE_ROOT/$1" ;;
  esac
  path=$(CDPATH= cd -- "$raw" 2>/dev/null && pwd) || die "not a directory: $1"

  root=$(CDPATH= cd -- "$DEVX_WORKTREE_ROOT" 2>/dev/null && pwd) || die "no worktree root at $DEVX_WORKTREE_ROOT"
  case "$path/" in
    "$root"/?*) : ;;
    *) die "refusing to remove a path outside $root: $path" ;;
  esac

  git -C "$PRIMARY" worktree remove --force "$path"
  git -C "$PRIMARY" worktree prune
  printf 'devx-worktree: removed %s (its branch is left intact for the PR)\n' "$path" >&2
}

cmd_ls() {
  [ -d "$DEVX_WORKTREE_ROOT" ] || { printf 'devx-worktree: no worktrees (%s does not exist)\n' "$DEVX_WORKTREE_ROOT" >&2; return 0; }
  root=$(CDPATH= cd -- "$DEVX_WORKTREE_ROOT" && pwd)

  git -C "$PRIMARY" worktree list --porcelain | awk -v root="$root/" '
    /^worktree / { wt = substr($0, 10); br = "(detached)"; next }
    /^branch /   { br = substr($0, 8); sub(/^refs\/heads\//, "", br); next }
    /^$/         { if (wt != "" && index(wt, root) == 1) print wt "\t" br; wt = "" }
    END          { if (wt != "" && index(wt, root) == 1) print wt "\t" br }
  ' | while IFS='	' read -r wt br; do
    dirty=$(git -C "$wt" status --porcelain 2>/dev/null | grep -c . || true)
    printf '%s\t%s\t%s dirty\n' "$wt" "$br" "$dirty"
  done
}

sub=${1:-}
[ "$#" -gt 0 ] && shift || true
case "$sub" in
  new) cmd_new "$@" ;;
  rm) cmd_rm "$@" ;;
  ls) cmd_ls ;;
  *) die "usage: devx-worktree.sh {new [name] | rm <name|path> | ls}" ;;
esac
