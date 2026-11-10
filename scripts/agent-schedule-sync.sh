#!/bin/sh
#
# agent-schedule-sync.sh {run|install|uninstall|status}
#
# Keeps the Mac mini's launchd schedules in step with origin/main, so a
# merged SCHEDULE change, a new agent or a removed one needs no hand restart
# (docs/agent-automation-setup.md). launchd runs it every 15 minutes as its
# own job; it never starts `claude`.
#
#   run        bring the scheduler clone to origin/main (agent-team.sh check),
#              then, per agent:
#                - on the team, and its installed plist differs from what
#                  agent-schedule-install.sh would write (a new SCHEDULE, a
#                  new agent): reinstall it through agent-team.sh start
#                - its plist exists but launchd hasn't loaded it: stopped by
#                  hand, so left alone
#                - installed, but its schedule file is gone from main:
#                  uninstall it
#              Reloading a launchd job kills its running process, so an
#              agent with a run in progress is left for the next sync.
#              Logs only what it changes, and failures.
#   install    install this job (agent-team.sh start and restart do this)
#   uninstall  remove this job (agent-team.sh stop does this)
#   status     launchd's view of this job
#
# Works on the scheduler clone (AGENT_SCHEDULER_CLONE, default
# ~/agents/nyc-311), like agent-team.sh.

set -u

CLONE=${AGENT_SCHEDULER_CLONE:-"$HOME/agents/nyc-311"}
INTERVAL_SECONDS=900
LABEL=com.nyc311.schedule-sync
AGENT_LABEL_PREFIX=com.nyc311.agent.
agents_dir="$HOME/Library/LaunchAgents"
plist="$agents_dir/$LABEL.plist"
domain="gui/$(id -u)"
log_dir="${AGENT_LOG_ROOT:-"$HOME/Library/Logs/nyc311-agents"}/schedule-sync"
log_file="$log_dir/sync.log"
LOG_MAX_BYTES=1048576

die() { printf 'agent-schedule-sync: %s\n' "$*" >&2; exit 1; }

log() {
  mkdir -p "$log_dir"
  if [ -f "$log_file" ] && [ "$(wc -c <"$log_file" | tr -d ' ')" -gt "$LOG_MAX_BYTES" ]; then
    mv -f "$log_file" "$log_file.1"
  fi
  printf '[%s] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*" >>"$log_file"
}

loaded() { launchctl print "$domain/$1" >/dev/null 2>&1; }

cmd_run() {
  [ -d "$CLONE/.git" ] || { log "ERROR: no scheduler clone at $CLONE"; exit 1; }
  lock="$log_dir/.sync.lock"
  mkdir -p "$log_dir"
  if ! mkdir "$lock" 2>/dev/null; then
    held=$(cat "$lock/pid" 2>/dev/null || true)
    if [ -n "$held" ] && kill -0 "$held" 2>/dev/null; then exit 0; fi
    rm -rf "$lock"
    mkdir "$lock" || exit 1
  fi
  echo $$ >"$lock/pid"
  trap 'rm -rf "$lock"' EXIT INT TERM

  # A change to this script lands with the fast-forward, so after it, re-run
  # the clone's own copy once.
  if [ -z "${AGENT_SCHEDULE_SYNC_CHECKED:-}" ]; then
    before=$(git -C "$CLONE" rev-parse HEAD 2>/dev/null)
    if ! out=$(/bin/sh "$CLONE/scripts/agent-team.sh" check 2>&1); then
      log "ERROR: the latest-code check failed; nothing changed: $(printf '%s' "$out" | tail -1)"
      exit 1
    fi
    after=$(git -C "$CLONE" rev-parse HEAD)
    if [ "$before" != "$after" ]; then
      log "scheduler clone moved ${before%"${before#???????}"}..${after%"${after#???????}"}"
      rm -rf "$lock"
      trap - EXIT INT TERM
      AGENT_SCHEDULE_SYNC_CHECKED=1 exec /bin/sh "$CLONE/scripts/agent-schedule-sync.sh" run
    fi
  fi

  installer="$CLONE/scripts/agent-schedule-install.sh"
  team=$(/bin/sh "$CLONE/scripts/agent-team.sh" list) || { log "ERROR: could not list the team"; exit 1; }

  changed=""
  for agent in $team; do
    agent_plist="$agents_dir/$AGENT_LABEL_PREFIX$agent.plist"
    if [ -f "$agent_plist" ] && ! loaded "$AGENT_LABEL_PREFIX$agent"; then
      continue
    fi
    rendered=$(/bin/sh "$installer" render "$agent" 2>&1) || { log "ERROR: $agent: $rendered"; continue; }
    if [ -f "$agent_plist" ] && printf '%s\n' "$rendered" | cmp -s - "$agent_plist"; then
      continue
    fi
    if pgrep -f "agent-scheduled-run\.sh $agent\$" >/dev/null 2>&1; then
      log "$agent: schedule changed, but a run is in progress; next sync"
      continue
    fi
    changed="$changed $agent"
  done

  if [ -n "$changed" ]; then
    # shellcheck disable=SC2086
    if out=$(AGENT_TEAM_FROM_SYNC=1 /bin/sh "$CLONE/scripts/agent-team.sh" start $changed 2>&1); then
      printf '%s\n' "$out" | grep -v 'latest origin/main' | while IFS= read -r line; do log "$line"; done
    else
      log "ERROR: reinstalling$changed failed: $(printf '%s' "$out" | tail -1)"
    fi
  fi

  for agent_plist in "$agents_dir/$AGENT_LABEL_PREFIX"*.plist; do
    [ -f "$agent_plist" ] || continue
    agent=$(basename "$agent_plist" .plist)
    agent=${agent#"$AGENT_LABEL_PREFIX"}
    [ -f "$CLONE/scripts/agent-schedules/$agent.env" ] && continue
    launchctl bootout "$domain/$AGENT_LABEL_PREFIX$agent" 2>/dev/null || true
    rm -f "$agent_plist"
    log "$agent: its schedule file is gone from main; uninstalled"
  done
}

cmd_install() {
  mkdir -p "$agents_dir" "$log_dir"
  cat >"$plist" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<!-- Generated by scripts/agent-schedule-sync.sh install. -->
<plist version="1.0">
<dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/sh</string>
    <string>$CLONE/scripts/agent-schedule-sync.sh</string>
    <string>run</string>
  </array>
  <key>StartInterval</key><integer>$INTERVAL_SECONDS</integer>
  <key>RunAtLoad</key><true/>
  <key>StandardOutPath</key><string>$log_dir/launchd.log</string>
  <key>StandardErrorPath</key><string>$log_dir/launchd.log</string>
</dict>
</plist>
EOF
  plutil -lint "$plist" >/dev/null || die "generated plist failed plutil -lint: $plist"
  launchctl bootout "$domain/$LABEL" 2>/dev/null || true
  launchctl bootstrap "$domain" "$plist" || die "launchd didn't load $plist"
  printf 'installed %s — every %s minutes; log: %s\n' "$LABEL" "$((INTERVAL_SECONDS / 60))" "$log_file"
}

cmd_uninstall() {
  launchctl bootout "$domain/$LABEL" 2>/dev/null || true
  rm -f "$plist"
  printf 'uninstalled %s\n' "$LABEL"
}

case "${1:-}" in
  run) cmd_run ;;
  install) cmd_install ;;
  uninstall) cmd_uninstall ;;
  status) launchctl print "$domain/$LABEL" | grep -E 'state =|last exit code|runs =' || die "$LABEL not loaded" ;;
  *) die "usage: agent-schedule-sync.sh {run|install|uninstall|status}" ;;
esac
