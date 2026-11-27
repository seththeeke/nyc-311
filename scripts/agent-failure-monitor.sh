#!/bin/sh
#
# agent-failure-monitor.sh {run|install|uninstall|status}
#
# Texts the owner (scripts/agent-notify.sh, iMessage) when scheduled agent
# runs fail, and when no agent has completed a run in a while. launchd runs
# it every 6 hours as its own job. It only reads the run logs
# (~/Library/Logs/nyc311-agents/<agent>/<timestamp>.log); it never starts,
# stops or changes a run.
#
#   run        one pass: read every run log that finished since the last
#              pass, then send at most one text covering:
#                - an agent whose latest run failed (non-zero exit, or the run
#                  died before its "=== done" line): at once for a newly
#                  failing agent, else every MONITOR_REMIND_HOURS while any
#                  keeps failing; each text lists every failing agent
#                - an alerted agent's first successful run since
#                - no successful run by any agent in MONITOR_SILENCE_HOURS
#              IDLE runs and runs skipped on the lock count as neither. The
#              first pass only records the runs already there, so installing
#              never texts about old runs.
#   install    install this job; its first pass, from launchd, sends a test
#              text, so a Messages permission prompt shows up now
#   uninstall  remove this job
#   status     launchd's view of this job
#
# Settings live in ~/.config/nyc311-agents/notify.env (AGENT_NOTIFY_CONFIG),
# shared with agent-notify.sh: MONITOR_SILENCE_HOURS (default 6) and
# MONITOR_REMIND_HOURS (default 6). State and log:
# ~/Library/Logs/nyc311-agents/monitor/ (AGENT_MONITOR_STATE overrides).
# AGENT_MONITOR_NOW (epoch seconds) replays a pass as of that time, ignoring
# later runs; with AGENT_NOTIFY_DRY_RUN=1 and a scratch state dir it tests
# the monitor against real logs without texting.

set -u

PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"
export PATH

LABEL=com.nyc311.failure-monitor
INTERVAL_SECONDS=21600
LOG_MAX_BYTES=1048576
# A run log with no "=== done" line, untouched this long and not held by a live lock, died.
DIED_AFTER_SECONDS=900

script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
log_root=${AGENT_LOG_ROOT:-"$HOME/Library/Logs/nyc311-agents"}
state_dir=${AGENT_MONITOR_STATE:-"$log_root/monitor"}
config=${AGENT_NOTIFY_CONFIG:-"$HOME/.config/nyc311-agents/notify.env"}
agents_dir="$HOME/Library/LaunchAgents"
plist="$agents_dir/$LABEL.plist"
domain="gui/$(id -u)"

die() { printf 'agent-failure-monitor: %s\n' "$*" >&2; exit 1; }

log() {
  mkdir -p "$state_dir"
  f="$state_dir/monitor.log"
  if [ -f "$f" ] && [ "$(wc -c <"$f" | tr -d ' ')" -gt "$LOG_MAX_BYTES" ]; then
    mv -f "$f" "$f.1"
  fi
  printf '[%s] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*" >>"$f"
}

fmt() { date -r "$1" '+%a %-d %b %H:%M'; }

notify() { "$script_dir/agent-notify.sh" "$1"; }

# A failed run's cause, from its report(s) and log, as one short line.
reason_for() {
  base=${1%.log}
  files="$1"
  for r in "$base".report.md "$base".*.report.md; do
    [ -f "$r" ] && files="$files $r"
  done
  # shellcheck disable=SC2086
  if grep -qs -e 'OAuth session expired' -e 'Failed to authenticate' $files; then
    echo "Claude login expired. Fix: run claude /login on $(hostname -s)"
  elif grep -qsF 'gh is not authenticated' $files; then
    echo "GitHub CLI signed out. Fix: gh auth login"
  elif grep -qsF "'claude' not on PATH" $files; then
    echo "claude isn't on PATH for launchd"
  elif grep -qsi 'usage limit' $files; then
    echo "Claude usage limit reached"
  else
    last=""
    for r in $files; do
      [ "$r" = "$1" ] && continue
      l=$(grep -v '^[[:space:]]*$' "$r" | tail -1)
      [ -n "$l" ] && last=$l
    done
    [ -n "$last" ] || last=$(grep -v -e '^[[:space:]]*$' -e '=== done' "$1" | tail -1)
    printf '%s\n' "$last" | cut -c1-120
  fi
}

load_agent() {
  FAIL_SINCE=0; FAIL_COUNT=0; LAST_ALERT=0
  # shellcheck disable=SC1090
  [ -f "$state_dir/agents/$1.state" ] && . "$state_dir/agents/$1.state"
}

save_agent() {
  printf 'FAIL_SINCE=%s\nFAIL_COUNT=%s\nLAST_ALERT=%s\n' "$FAIL_SINCE" "$FAIL_COUNT" "$LAST_ALERT" \
    >"$state_dir/agents/$1.state"
}

save_global() {
  printf 'LAST_SUCCESS=%s\nLAST_SUCCESS_AGENT=%s\nSILENCE_ALERTED=%s\nLAST_FAIL_ALERT=%s\n' \
    "$LAST_SUCCESS" "$LAST_SUCCESS_AGENT" "$SILENCE_ALERTED" "$LAST_FAIL_ALERT" >"$state_dir/state.env"
}

cmd_run() {
  # shellcheck disable=SC1090
  [ -f "$config" ] && . "$config"
  silence_hours=${MONITOR_SILENCE_HOURS:-6}
  remind_seconds=$(( ${MONITOR_REMIND_HOURS:-6} * 3600 ))
  now=${AGENT_MONITOR_NOW:-$(date +%s)}

  mkdir -p "$state_dir/agents"
  lock="$state_dir/.monitor.lock"
  if ! mkdir "$lock" 2>/dev/null; then
    held=$(cat "$lock/pid" 2>/dev/null || true)
    if [ -n "$held" ] && kill -0 "$held" 2>/dev/null; then exit 0; fi
    rm -rf "$lock"
    mkdir "$lock" || exit 1
  fi
  echo $$ >"$lock/pid"
  tmp=$(mktemp -d)
  trap 'rm -rf "$lock" "$tmp"' EXIT INT TERM

  if [ -f "$state_dir/send-test" ]; then
    if notify "✅ NYC 311 agent monitor is running on $(hostname -s). It checks every $((INTERVAL_SECONDS / 3600))h and texts you when an agent run fails or no agent has finished a run in ${silence_hours}h."; then
      rm -f "$state_dir/send-test"
      log "sent the install test text"
    else
      log "ERROR: the install test text failed (Messages permission for launchd?)"
    fi
  fi

  seen="$state_dir/seen"
  first=""
  [ -f "$seen" ] || { first=1; : >"$seen"; }
  LAST_SUCCESS=0; LAST_SUCCESS_AGENT=""; SILENCE_ALERTED=0; LAST_FAIL_ALERT=0
  # shellcheck disable=SC1090
  [ -f "$state_dir/state.env" ] && . "$state_dir/state.env"

  # Every per-run log not seen yet; sorted names put each agent's runs oldest first.
  (cd "$log_root" && ls -1 -- */*.log 2>/dev/null) \
    | grep -v -e '/launchd\.log$' -e '^monitor/' -e '^schedule-sync/' | sort >"$tmp/all"
  sort -o "$tmp/seen" "$seen"
  comm -23 "$tmp/all" "$tmp/seen" >"$tmp/new"

  recovered=""
  processed=0
  while IFS= read -r rel; do
    agent=${rel%%/*}
    f="$log_root/$rel"
    line=$(grep -F '=== done (' "$f" | tail -1)
    if [ -n "$line" ]; then
      ts=$(printf '%s' "$line" | sed -n 's/^\[\([^]]*\)\].*/\1/p')
      at=$(date -j -f '%Y-%m-%d %H:%M:%S' "$ts" +%s 2>/dev/null) || continue
      [ "$at" -le "$now" ] || continue
      mode=$(printf '%s' "$line" | sed -n 's/.*=== done (\([A-Z_]*\), exit \([0-9]*\)).*/\1/p')
      code=$(printf '%s' "$line" | sed -n 's/.*=== done (\([A-Z_]*\), exit \([0-9]*\)).*/\2/p')
    else
      at=$(stat -f %m "$f")
      [ "$at" -le "$now" ] || continue
      if grep -qF 'is in progress — skipping' "$f"; then
        mode=SKIPPED; code=0
      else
        [ $((now - at)) -ge "$DIED_AFTER_SECONDS" ] || continue
        newest=$(ls -1 "$log_root/$agent"/*.log | grep -v '/launchd\.log$' | tail -1)
        pid=$(cat "$log_root/$agent/.run.lock/pid" 2>/dev/null || true)
        if [ "$f" = "$newest" ] && [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then continue; fi
        mode=DIED; code=died
      fi
    fi
    echo "$rel" >>"$seen"
    processed=$((processed + 1))

    success=""
    [ "$code" = 0 ] && [ "$mode" != IDLE ] && [ "$mode" != SKIPPED ] && success=1
    if [ -n "$success" ] && [ "$at" -gt "$LAST_SUCCESS" ]; then
      LAST_SUCCESS=$at; LAST_SUCCESS_AGENT=$agent
    fi
    [ -z "$first" ] || continue

    load_agent "$agent"
    if [ -n "$success" ]; then
      if [ "$FAIL_SINCE" -ne 0 ]; then
        log "$agent recovered: $rel after $FAIL_COUNT failed run(s)"
        [ "$LAST_ALERT" -ne 0 ] && recovered="$recovered${recovered:+, }$agent ($FAIL_COUNT failed runs)"
        FAIL_SINCE=0; FAIL_COUNT=0; LAST_ALERT=0
      fi
    elif [ "$code" != 0 ]; then
      reason_for "$f" >"$state_dir/agents/$agent.reason"
      [ "$FAIL_SINCE" -ne 0 ] || FAIL_SINCE=$at
      FAIL_COUNT=$((FAIL_COUNT + 1))
      log "$agent failed: $rel ($mode, exit $code): $(cat "$state_dir/agents/$agent.reason")"
    fi
    save_agent "$agent"
  done <"$tmp/new"

  if [ -n "$first" ]; then
    log "first pass: recorded $processed existing run(s); last success ${LAST_SUCCESS_AGENT:-none}"
    save_global
    return 0
  fi

  # Every failing agent; one never alerted (new) is due a text now, the rest on the shared reminder clock.
  : >"$tmp/failing"
  alerted=""
  any_failing=""
  any_new=""
  for st in "$state_dir"/agents/*.state; do
    [ -f "$st" ] || continue
    agent=$(basename "$st" .state)
    load_agent "$agent"
    [ "$FAIL_SINCE" -ne 0 ] || continue
    any_failing=1
    if [ "$LAST_ALERT" -eq 0 ]; then kind=1NEW; any_new=1; else kind=2REMIND; fi
    reason=$(cat "$state_dir/agents/$agent.reason" 2>/dev/null || echo "unknown cause")
    printf '%s\t%s\t%s\t%s\t%s\t%s\n' "$kind" "$reason" "$agent" "$FAIL_COUNT" "$FAIL_SINCE" "$(fmt "$FAIL_SINCE")" >>"$tmp/failing"
    alerted="$alerted $agent"
  done

  body=""
  fail_alerted=""
  if [ -n "$any_new" ] || { [ -n "$any_failing" ] && [ $((now - LAST_FAIL_ALERT)) -ge "$remind_seconds" ]; }; then
    fail_alerted=1
    body=$(sort "$tmp/failing" | awk -F'\t' '
      function flush() {
        if (key == "") return
        if (k == "1NEW") printf "🚨 Failing: %s\n%s\n", names, r
        else printf "⏰ Still failing since %s: %s\n%s\n", sincef, names, r
      }
      { cur = $1 FS $2
        if (cur != key) { flush(); key = cur; k = $1; r = $2; names = ""; since = $5; sincef = $6 }
        names = names (names == "" ? "" : ", ") $3 " (" $4 " run" ($4 == 1 ? "" : "s") ")"
        if ($5 < since) { since = $5; sincef = $6 } }
      END { flush() }')
  fi
  [ -n "$recovered" ] && body="$body${body:+
}✅ Recovered: $recovered"

  silence_text=""
  gap_alerted=""
  if [ "$LAST_SUCCESS" -gt 0 ] && [ -z "$any_failing" ]; then
    gap=$((now - LAST_SUCCESS))
    if [ "$gap" -ge $((silence_hours * 3600)) ]; then
      if [ "$SILENCE_ALERTED" -eq 0 ] || [ $((now - SILENCE_ALERTED)) -ge "$remind_seconds" ]; then
        silence_text="⚠️ Agents have not contributed in $((gap / 3600))h. Last successful run: $LAST_SUCCESS_AGENT at $(fmt "$LAST_SUCCESS"). Check that the Mac mini is awake and launchd jobs are loaded."
        gap_alerted=1
      fi
    elif [ "$SILENCE_ALERTED" -ne 0 ]; then
      body="$body${body:+
}✅ Agents contributing again: $LAST_SUCCESS_AGENT finished a run at $(fmt "$LAST_SUCCESS")"
      SILENCE_ALERTED=0
    fi
  fi
  [ -n "$silence_text" ] && body="$body${body:+
}$silence_text"

  if [ -n "$body" ]; then
    msg="NYC 311 agents
$body"
    if notify "$msg"; then
      log "texted: $(printf '%s' "$msg" | tr '\n' ' ')"
      if [ -n "$fail_alerted" ]; then
        for agent in $alerted; do
          load_agent "$agent"; LAST_ALERT=$now; save_agent "$agent"
        done
        LAST_FAIL_ALERT=$now
      fi
      [ -n "$gap_alerted" ] && SILENCE_ALERTED=$now
    else
      log "ERROR: text failed; retrying next pass: $(printf '%s' "$msg" | tr '\n' ' ')"
    fi
  fi
  save_global

  # Forget runs whose logs the 30-day retention has deleted.
  while IFS= read -r rel; do [ -f "$log_root/$rel" ] && echo "$rel"; done <"$seen" >"$tmp/kept"
  cat "$tmp/kept" >"$seen"
}

cmd_install() {
  [ -f "$config" ] || die "no config at $config (set NOTIFY_IMESSAGE_TO there first)"
  mkdir -p "$agents_dir" "$state_dir"
  cat >"$plist" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<!-- Generated by scripts/agent-failure-monitor.sh install. -->
<plist version="1.0">
<dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/sh</string>
    <string>$script_dir/agent-failure-monitor.sh</string>
    <string>run</string>
  </array>
  <key>StartInterval</key><integer>$INTERVAL_SECONDS</integer>
  <key>RunAtLoad</key><true/>
  <key>StandardOutPath</key><string>$state_dir/launchd.log</string>
  <key>StandardErrorPath</key><string>$state_dir/launchd.log</string>
</dict>
</plist>
EOF
  plutil -lint "$plist" >/dev/null || die "generated plist failed plutil -lint: $plist"
  : >"$state_dir/send-test"
  launchctl bootout "$domain/$LABEL" 2>/dev/null || true
  launchctl bootstrap "$domain" "$plist" || die "launchd didn't load $plist"
  printf 'installed %s: every %sh; log: %s/monitor.log\n' "$LABEL" "$((INTERVAL_SECONDS / 3600))" "$state_dir"
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
  *) die "usage: agent-failure-monitor.sh {run|install|uninstall|status}" ;;
esac
