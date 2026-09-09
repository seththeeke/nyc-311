#!/bin/sh
#
# agent-worktree.sh — git-worktree isolation for running ANY agent (or several
# at once) against this repo without their working tree / index / HEAD
# colliding. Not tied to any one agent (docs/autonomous-agent-plan.md).
#
# A git worktree shares one .git object store and ref namespace but has its own
# working tree, index, and HEAD. node_modules is populated by an APFS
# copy-on-write clone (`cp -c`) so it costs near-zero disk and only diverges
# from the primary on write.
#
# Subcommands:
#   run <agent> <prompt…>  one-shot: make a worktree, run `claude --agent
#                          <agent> -p "<prompt>"` inside it, then tear the
#                          worktree down (its branch survives) if the run
#                          exited 0 and left nothing uncommitted. This is the
#                          normal way to kick off one run.
#   new [name]     create a worktree at origin/main (detached HEAD), print its path
#   rm <name|path> remove a worktree; its branch (if any) is left intact
#   ls             list agent worktrees with branch + dirty-file count
#
# Worktrees live in a sibling dir <repo>-worktrees/<name> (override with
# AGENT_WORKTREE_ROOT) — outside the repo, so no tool/glob recursion or
# nested-repo edge cases.
#
# Per-worktree commit stamping: .claude/hooks/stamp-committer.sh and
# .githooks/prepare-commit-msg key the committer stamp to the per-worktree git
# dir, so concurrent commits from parallel worktrees keep their correct agent
# prefix regardless of which agent (or the main session) made them.
#
# NOTE: the design doc specified `flock` to serialize the fetch; macOS ships no
# flock, so `new` uses an atomic `mkdir` lock with the same effect.

set -eu

script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
PRIMARY=$(git -C "$script_dir" rev-parse --show-toplevel)
AGENT_WORKTREE_ROOT=${AGENT_WORKTREE_ROOT:-"$(dirname -- "$PRIMARY")/$(basename -- "$PRIMARY")-worktrees"}
LOCK_DIR="$AGENT_WORKTREE_ROOT/.agent-worktree.lock"

# gitignored-but-required files to copy into each worktree (relative to repo root).
# Without settings.local.json a headless `-p` run prompts on nearly every tool call.
# Root .env is personal notes only — not copied.
COPY_UNTRACKED='.claude/settings.local.json
web-app/.env.local'

# Packages whose node_modules get CoW-cloned.
NODE_PKGS='. web-app backend cdk'

die() { printf 'agent-worktree: %s\n' "$*" >&2; exit 1; }

cmd_new() {
  name=${1:-}
  if [ -z "$name" ]; then
    rand=$(od -An -N2 -tx1 /dev/urandom | tr -d ' \n')
    name="wt-$(date +%s)-$rand"
  fi
  case "$name" in
    */* | .* | '') die "invalid worktree name: '$name'" ;;
  esac
  dest="$AGENT_WORKTREE_ROOT/$name"
  [ -e "$dest" ] && die "worktree path already exists: $dest"

  mkdir -p "$AGENT_WORKTREE_ROOT"

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
      printf 'agent-worktree: note: %s absent in primary, not copied\n' "$rel" >&2
    fi
  done

  printf '%s\n' "$dest"
}

cmd_run() {
  [ "$#" -ge 2 ] || die "usage: agent-worktree.sh run <agent> <prompt...>"
  agent=$1
  shift
  command -v claude >/dev/null 2>&1 || die "'claude' not found on PATH"

  rand=$(od -An -N2 -tx1 /dev/urandom | tr -d ' \n')
  name="$agent-$(date +%s)-$rand"
  case "$name" in
    */* | .*) name="run-$(date +%s)-$rand" ;;
  esac

  dest=$(cmd_new "$name")
  printf 'agent-worktree: running %s in %s\n' "$agent" "$dest" >&2

  # Per-agent permission allowlist (committed, reviewable). `--settings` merges
  # it on top of .claude/settings{,.local}.json — headless `-p` can't answer a
  # prompt, so anything not allowed is silently denied.
  agent_settings=".claude/agent-settings/$agent.json"

  set +e
  if [ -f "$dest/$agent_settings" ]; then
    (cd "$dest" && claude --agent "$agent" --settings "$agent_settings" -p "$*")
  else
    printf 'agent-worktree: note: no %s — %s runs with the base allowlist only\n' "$agent_settings" "$agent" >&2
    (cd "$dest" && claude --agent "$agent" -p "$*")
  fi
  status=$?
  set -e

  dirty=$(git -C "$dest" status --porcelain 2>/dev/null | grep -c . || true)
  if [ "$status" -eq 0 ] && [ "$dirty" -eq 0 ]; then
    cmd_rm "$dest"
  else
    printf 'agent-worktree: kept %s (exit %s, %s uncommitted). Inspect: cd %s\n' \
      "$name" "$status" "$dirty" "$dest" >&2
    printf 'agent-worktree: remove when done: %s rm %s\n' "$0" "$name" >&2
  fi
  exit "$status"
}

cmd_rm() {
  [ "$#" -ge 1 ] || die "usage: agent-worktree.sh rm <name|path>"
  case "$1" in
    /*) raw="$1" ;;
    *) raw="$AGENT_WORKTREE_ROOT/$1" ;;
  esac
  path=$(CDPATH= cd -- "$raw" 2>/dev/null && pwd) || die "not a directory: $1"

  root=$(CDPATH= cd -- "$AGENT_WORKTREE_ROOT" 2>/dev/null && pwd) || die "no worktree root at $AGENT_WORKTREE_ROOT"
  case "$path/" in
    "$root"/?*) : ;;
    *) die "refusing to remove a path outside $root: $path" ;;
  esac

  git -C "$PRIMARY" worktree remove --force "$path"
  git -C "$PRIMARY" worktree prune
  printf 'agent-worktree: removed %s (its branch, if any, is left intact)\n' "$path" >&2
}

cmd_ls() {
  [ -d "$AGENT_WORKTREE_ROOT" ] || { printf 'agent-worktree: no worktrees (%s does not exist)\n' "$AGENT_WORKTREE_ROOT" >&2; return 0; }
  root=$(CDPATH= cd -- "$AGENT_WORKTREE_ROOT" && pwd)

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
  run) cmd_run "$@" ;;
  new) cmd_new "$@" ;;
  rm) cmd_rm "$@" ;;
  ls) cmd_ls ;;
  *) die "usage: agent-worktree.sh {run <agent> <prompt...> | new [name] | rm <name|path> | ls}" ;;
esac
