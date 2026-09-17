#!/bin/bash
#
# Stop hook for biz-intel-agent (wired in via that agent's frontmatter, so it
# only fires for this agent's turns — main-session use via `--agent
# biz-intel-agent`, or a SubagentStop when spawned as a subagent).
#
# The whole point of this agent is speed: one inference call produces a SQL
# query, and this hook — a deterministic script, not another model call —
# copies it to the clipboard. No second turn, no tool call, no round trip.
#
# Reads `last_assistant_message` straight off stdin (documented as the
# reliable, current-turn text for Stop/SubagentStop — the transcript file can
# lag), pulls the last ```sql fenced block out of it, and pipes that to
# pbcopy. Never blocks Stop: exits 0 on every path, including "no code block
# found" (e.g. the agent answered a meta question instead of emitting SQL).

input=$(cat)

python3 - "$input" <<'PYEOF'
import json
import re
import subprocess
import sys

raw = sys.argv[1]
try:
    data = json.loads(raw)
except Exception:
    sys.exit(0)

text = data.get("last_assistant_message") or ""
if not text:
    sys.exit(0)

blocks = re.findall(r"```sql\s*\n(.*?)```", text, re.IGNORECASE | re.DOTALL)
if not blocks:
    # Fall back to any fenced block if the model omitted the "sql" tag.
    blocks = re.findall(r"```[a-zA-Z]*\s*\n(.*?)```", text, re.DOTALL)
if not blocks:
    sys.exit(0)

query = blocks[-1].strip()
if not query:
    sys.exit(0)

try:
    subprocess.run(["pbcopy"], input=query.encode("utf-8"), check=True)
except Exception:
    pass

sys.exit(0)
PYEOF

exit 0
