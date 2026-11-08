#!/bin/sh
#
# agent-usage-summary.sh [hours]
#
# Totals the Claude usage of every scheduled agent run in the last [hours]
# (default 24), per agent and per run (docs/17-executive-team.md §21.4).
# Reads the transcripts Claude Code writes under ~/.claude/projects/: a
# scheduled run's worktree is <agent>-<epoch>-<rand> (agent-worktree.sh), so
# its project folder ends in -worktrees-<agent>-<epoch>-<rand>. Counts each
# API response once (by message and request id). Prints plain text for
# Penny's prompt; reads only, writes nothing. CLAUDE_PROJECTS_DIR overrides
# the folder (for a test).

set -eu

hours=${1:-24}
case "$hours" in '' | *[!0-9]*) printf 'agent-usage-summary: hours must be a whole number\n' >&2; exit 1 ;; esac

HOURS=$hours PROJECTS=${CLAUDE_PROJECTS_DIR:-"$HOME/.claude/projects"} exec python3 -I - <<'PY'
import json, os, re, sys, time
from collections import defaultdict
from datetime import datetime, timezone

hours = int(os.environ["HOURS"])
root = os.environ["PROJECTS"]
since = time.time() - hours * 3600
RUN = re.compile(r"-worktrees-(?P<agent>[a-z][a-z0-9-]*?)-(?P<epoch>\d{9,})-[0-9a-f]{4}$")

def stamp(value):
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00")).timestamp()
    except Exception:
        return None

runs = {}
seen = set()
if os.path.isdir(root):
    for folder in sorted(os.listdir(root)):
        match = RUN.search(folder)
        if not match:
            continue
        agent, epoch = match.group("agent"), int(match.group("epoch"))
        for base, _, files in os.walk(os.path.join(root, folder)):
            for name in files:
                path = os.path.join(base, name)
                if not name.endswith(".jsonl") or os.path.getmtime(path) < since:
                    continue
                with open(path, errors="replace") as handle:
                    for line in handle:
                        try:
                            entry = json.loads(line)
                        except Exception:
                            continue
                        message = entry.get("message") if isinstance(entry, dict) else None
                        if entry.get("type") != "assistant" or not isinstance(message, dict):
                            continue
                        usage = message.get("usage") or {}
                        at = stamp(entry.get("timestamp", ""))
                        if not usage or at is None or at < since:
                            continue
                        key = (message.get("id"), entry.get("requestId"))
                        if key in seen:
                            continue
                        seen.add(key)
                        run = runs.setdefault(folder, {"agent": agent, "epoch": epoch, "calls": 0, "in": 0, "out": 0, "cache_read": 0, "cache_write": 0, "models": set()})
                        run["calls"] += 1
                        run["in"] += usage.get("input_tokens") or 0
                        run["out"] += usage.get("output_tokens") or 0
                        run["cache_read"] += usage.get("cache_read_input_tokens") or 0
                        run["cache_write"] += usage.get("cache_creation_input_tokens") or 0
                        if message.get("model"):
                            run["models"].add(re.sub(r"^claude-|-\d{8}$", "", message["model"]))

def k(n):
    return f"{n / 1000:.1f}k" if n < 1_000_000 else f"{n / 1_000_000:.2f}M"

def fresh(r):
    return r["in"] + r["cache_write"] + r["out"]

print(f"Claude usage, last {hours} hours, scheduled agent runs only.")
print("fresh = input + cache writes + output, the tokens that weigh most on limits; cache reads are cheap and shown apart.")
if not runs:
    print("No runs found.")
    sys.exit(0)
agents = defaultdict(lambda: {"runs": 0, "calls": 0, "in": 0, "out": 0, "cache_read": 0, "cache_write": 0, "models": set()})
for run in runs.values():
    a = agents[run["agent"]]
    a["runs"] += 1
    for f in ("calls", "in", "out", "cache_read", "cache_write"):
        a[f] += run[f]
    a["models"] |= run["models"]
total = {f: sum(a[f] for a in agents.values()) for f in ("runs", "calls", "in", "out", "cache_read", "cache_write")}
print(f"TOTAL: {total['runs']} runs, {total['calls']} API calls, fresh {k(fresh(total))} (input {k(total['in'])}, cache writes {k(total['cache_write'])}, output {k(total['out'])}), cache reads {k(total['cache_read'])}")
print("Per agent:")
for name, a in sorted(agents.items(), key=lambda item: -fresh(item[1])):
    print(f"- {name}: {a['runs']} runs, fresh {k(fresh(a))}, output {k(a['out'])}, cache reads {k(a['cache_read'])}, models {', '.join(sorted(a['models'])) or '?'}")
print("Heaviest runs:")
for run in sorted(runs.values(), key=lambda r: -fresh(r))[:5]:
    started = datetime.fromtimestamp(run["epoch"], timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    print(f"- {run['agent']} at {started}: fresh {k(fresh(run))}, {run['calls']} calls")
PY
