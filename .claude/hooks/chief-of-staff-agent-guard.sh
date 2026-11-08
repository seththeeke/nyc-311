#!/bin/bash
#
# PreToolUse guard for chief-of-staff-agent (docs/17-executive-team.md §15,
# §21.4), wired in through the agent's frontmatter. Penny writes only her
# own reports: new files named chief-of-staff-agent-<name>.md in a run's
# folder under .claude/agent-reports/ (§21.3), or /tmp. Exit 2 blocks.

input=$(cat)
printf '%s' "$input" | PENNY_PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$PWD}" python3 -c '
import json, os, re, sys

try:
    data = json.load(sys.stdin)
except Exception:
    sys.exit(0)
if data.get("tool_name") not in ("Write", "Edit"):
    sys.exit(0)
project = os.path.realpath(os.environ["PENNY_PROJECT_DIR"])
raw = (data.get("tool_input") or {}).get("file_path", "")
path = os.path.realpath(os.path.join(project, raw))
if path.startswith("/tmp/") or path.startswith("/private/tmp/"):
    sys.exit(0)
reports = os.path.join(project, ".claude", "agent-reports") + os.sep
rel = path[len(reports):] if path.startswith(reports) else ""
if re.fullmatch(r"\d{4}-\d{2}-\d{2}/[0-2]\d_[0-5]\d/chief-of-staff-agent-[a-z0-9][a-z0-9-]*\.md", rel):
    sys.exit(0)
print(f"chief-of-staff-agent guard: writing {raw} is blocked; only your own reports in your run folder (.claude/agent-reports/<date>/<HH_MM>/chief-of-staff-agent-<name>.md) and /tmp.", file=sys.stderr)
sys.exit(2)
'
