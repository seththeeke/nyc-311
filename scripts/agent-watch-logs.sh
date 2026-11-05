#!/bin/sh
#
# agent-watch-logs.sh [agent ...] — live tail of the scheduled agents' logs on
# this machine. Read-only: it never starts a run.
#
# Follows each agent's launchd.log plus its newest run log, and switches to a
# new run log as soon as one appears. With no arguments it watches every agent
# that has a schedule (scripts/agent-schedules/<agent>.env); name agents to
# watch only those, e.g. `scripts/agent-watch-logs.sh cto-agent cpo-agent`.
# Logs: ~/Library/Logs/nyc311-agents/<agent>/ (AGENT_LOG_ROOT overrides).
# Ctrl-C to stop.

set -u

root=$(cd "$(dirname "$0")/.." && pwd)
log_root="${AGENT_LOG_ROOT:-"$HOME/Library/Logs/nyc311-agents"}"

if [ $# -gt 0 ]; then
  agents="$*"
else
  agents=$(for f in "$root"/scripts/agent-schedules/*.env; do
    a=$(basename "$f" .env)
    [ "$a" = team-chat ] || echo "$a"   # shared sign-in config, not an agent
  done)
fi

for a in $agents; do
  [ -f "$root/scripts/agent-schedules/$a.env" ] || { echo "agent-watch-logs: no schedule for $a" >&2; exit 1; }
done

# One line per run log across the watched agents; a new one means a new run.
run_logs() {
  for a in $agents; do ls "$log_root/$a"/2*.log 2>/dev/null; done
}

# launchd.log for every agent (tail -F picks it up once a first run creates
# it), plus each agent's newest run log.
watch_files() {
  for a in $agents; do
    echo "$log_root/$a/launchd.log"
    ls -t "$log_root/$a"/2*.log 2>/dev/null | head -1
  done
}

pid= nap=
trap 'kill $pid $nap 2>/dev/null; exit 0' INT TERM

echo "agent-watch-logs: watching $(echo $agents | tr ' ' ',') in $log_root"
while :; do
  # shellcheck disable=SC2046
  tail -n 30 -F $(watch_files) &
  pid=$!
  count=$(run_logs | wc -l)
  # Backgrounded so a signal runs the trap now, not after the sleep.
  while [ "$(run_logs | wc -l)" = "$count" ]; do sleep 30 & nap=$!; wait "$nap"; done
  kill "$pid" 2>/dev/null
  printf '\n=== new run log detected, switching ===\n\n'
done
