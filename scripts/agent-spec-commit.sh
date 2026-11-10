#!/bin/sh
#
# agent-spec-commit.sh <issue> — commits Kid Kestrel's spec for <issue>
# straight to main (docs/17-executive-team.md §22.3), and nothing else.
# Run from the root of the run's worktree. Accepts exactly one changed file
# under docs/kid-kestral/, named <issue>-<slug>.md, within the size cap; any
# other change there is refused and nothing is committed. Other changes in
# the worktree (a leg's code, on its branch) are left alone. Prints the
# commit. After it, the spec's content is on origin/main and the worktree's
# copy is reset to HEAD: read or edit it again from origin/main
# (`git checkout origin/main -- docs/kid-kestral/<file>`).

set -u

SPEC_DIR=docs/kid-kestral
SPEC_MAX_BYTES=65536

die() { printf 'agent-spec-commit: %s\n' "$*" >&2; exit 1; }

issue=${1:-}
case "$issue" in '' | *[!0-9]*) die "usage: agent-spec-commit.sh <issue>" ;; esac
dest=$(git rev-parse --show-toplevel 2>/dev/null) || die "not in a git worktree"

changes=$(git -C "$dest" status --porcelain --untracked-files=all -- "$SPEC_DIR")
[ -n "$changes" ] || die "no change under $SPEC_DIR to commit"
[ "$(printf '%s\n' "$changes" | grep -c .)" -eq 1 ] || die "more than one file changed under $SPEC_DIR; a run commits one spec at a time"

path=${changes#?? }
code=${changes%% *}
case "$code" in D) die "$path was deleted; specs are never deleted" ;; esac
case "$path" in
  "$SPEC_DIR/$issue-"*.md) : ;;
  *) die "$path is not $SPEC_DIR/$issue-<slug>.md" ;;
esac
slug=${path#"$SPEC_DIR/$issue-"}
slug=${slug%.md}
case "$slug" in '' | -* | *[!a-z0-9-]*) die "the slug in $path must be lowercase-kebab" ;; esac
bytes=$(wc -c <"$dest/$path" | tr -d ' ')
[ "$bytes" -le "$SPEC_MAX_BYTES" ] || die "$path is $bytes bytes, over the $SPEC_MAX_BYTES-byte cap"

if sha=$("$(dirname -- "$0")/agent-commit-to-main.sh" "$dest" "[feat] - gen-purpose-dev: Spec #$issue ($path)" "$path"); then
  printf '%s %s\n' "$sha" "$path"
  exit 0
fi
die "the spec was not pushed to main; it is still in the worktree"
