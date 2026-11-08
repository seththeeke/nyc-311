#!/bin/sh
#
# agent-reports-sync.sh <agent>
#
# Copies every report <agent> has committed to main
# (.claude/agent-reports/<date>/<HH_MM>/<agent>-*.md, docs/17 §21.3) to
# s3://$REPORTS_BUCKET/<agent>/<date>/<HH_MM>/, as the agent's own AWS
# profile ($REPORTS_AWS_PROFILE), for the website (docs/17 §19.6). Reads from
# origin/main, so a run whose sync failed is caught up by the next. Adds and
# updates only; never deletes. Run by agent-scheduled-run.sh after the run.

set -u

agent=${1:?usage: agent-reports-sync.sh <agent>}
: "${REPORTS_BUCKET:?REPORTS_BUCKET not set}" "${REPORTS_AWS_PROFILE:?REPORTS_AWS_PROFILE not set}"

script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
primary=$(git -C "$script_dir" rev-parse --show-toplevel) || exit 1
tmp=$(mktemp -d) || exit 1
trap 'rm -rf "$tmp"' EXIT INT TERM

git -C "$primary" fetch -q origin main || { printf 'agent-reports-sync: fetch failed\n' >&2; exit 1; }
if ! git -C "$primary" cat-file -e origin/main:.claude/agent-reports 2>/dev/null; then
  printf 'agent-reports-sync: no reports on main\n' >&2
  exit 0
fi
git -C "$primary" archive origin/main .claude/agent-reports | tar -x -C "$tmp" || exit 1

mkdir -p "$tmp/stage"
count=0
for file in "$tmp"/.claude/agent-reports/*/*/"$agent"-*.md; do
  [ -f "$file" ] || continue
  rel=${file#"$tmp/.claude/agent-reports/"}
  mkdir -p "$tmp/stage/$(dirname -- "$rel")"
  cp "$file" "$tmp/stage/$rel"
  count=$((count + 1))
done
if [ "$count" -eq 0 ]; then
  printf 'agent-reports-sync: no %s reports on main\n' "$agent" >&2
  exit 0
fi

aws --profile "$REPORTS_AWS_PROFILE" --region us-east-1 s3 sync "$tmp/stage" "s3://$REPORTS_BUCKET/$agent/" \
  --only-show-errors --content-type "text/markdown; charset=utf-8" || exit 1
printf 'agent-reports-sync: %s reports in s3://%s/%s/\n' "$count" "$REPORTS_BUCKET" "$agent" >&2
