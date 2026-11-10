#!/bin/sh
#
# agent-team.sh {start|stop|restart|status|check} [agent ...]
#
# Starts, stops or restarts the scheduled agents on the Mac mini in one go.
# With no agent named it acts on the whole team: every agent with a
# scripts/agent-schedules/<agent>.env except NOT_ON_TEAM below. Name agents to
# act on just those.
#
#   start    check the scheduler clone is on the latest origin/main (fast-
#            forwarding it when it can, and npm ci where a lockfile changed),
#            then install each agent's launchd schedule from the clone
#   stop     unload each agent's schedule (its plist is kept) and kill any run
#            of it in progress, scheduled or by hand
#   restart  stop, then start
#   status   one line per agent: loaded or not, script path, running or not
#   check    only the latest-code check that start and restart run first
#
# It always works on the scheduler clone (AGENT_SCHEDULER_CLONE, default
# ~/agents/nyc-311), wherever it's run from: launchd can't read ~/Documents,
# so a schedule installed from any other checkout fails every run. It starts
# no run itself; launchd starts them at their scheduled times.

set -u

CLONE=${AGENT_SCHEDULER_CLONE:-"$HOME/agents/nyc-311"}
# Agents with a schedule file that aren't started with the team. Empty: every
# agent, Kid Kestrel (gen-purpose-dev) included, is on the team.
NOT_ON_TEAM=""
# Same list as agent-worktree.sh's NODE_PKGS (#175).
LOCKFILE_PACKAGES=". web-app backend cdk customer/backend agent-web-app"

die() { printf 'agent-team: %s\n' "$*" >&2; exit 1; }
say() { printf 'agent-team: %s\n' "$*"; }

sub=${1:-}
usage="usage: agent-team.sh {start|stop|restart|status|check} [agent ...]"
[ -n "$sub" ] || die "$usage"
shift

[ -d "$CLONE/.git" ] || die "no scheduler clone at $CLONE (see docs/agent-automation-setup.md)"
case "$CLONE" in */Documents/*) die "the scheduler clone can't live under ~/Documents: launchd can't read it" ;; esac
schedules="$CLONE/scripts/agent-schedules"
installer="$CLONE/scripts/agent-schedule-install.sh"
domain="gui/$(id -u)"

team() {
  for f in "$schedules"/*.env; do
    a=$(basename "$f" .env)
    [ "$a" = team-chat ] && continue
    case " $NOT_ON_TEAM " in *" $a "*) continue ;; esac
    printf '%s\n' "$a"
  done
}

named="$*"

# The agents to act on. Resolved after the latest-code check, so a just-merged agent's .env is found.
resolve_agents() {
  if [ -n "$named" ]; then agents=$named; else agents=$(team); fi
  [ -n "$agents" ] || die "no agents found in $schedules"
  for a in $agents; do
    [ -f "$schedules/$a.env" ] || die "no schedule config for '$a' at $schedules/$a.env (not merged yet, or a typo?)"
  done
}

# ---- the latest-code check ----------------------------------------------------

ensure_latest() {
  branch=$(git -C "$CLONE" branch --show-current)
  [ "$branch" = main ] || die "the scheduler clone is on '${branch:-a detached HEAD}', not main. Fix it: git -C $CLONE checkout main"
  dirty=$(git -C "$CLONE" status --porcelain | grep -c . || true)
  [ "$dirty" -eq 0 ] || die "the scheduler clone has $dirty changed file(s); it must be clean. See: git -C $CLONE status"
  git -C "$CLONE" fetch --quiet origin main || die "git fetch origin main failed in $CLONE"
  head=$(git -C "$CLONE" rev-parse HEAD)
  latest=$(git -C "$CLONE" rev-parse origin/main)
  if [ "$head" != "$latest" ]; then
    git -C "$CLONE" merge-base --is-ancestor "$head" "$latest" || die "the scheduler clone has commits origin/main doesn't; it can't fast-forward. See: git -C $CLONE log origin/main..HEAD"
    say "scheduler clone is $(git -C "$CLONE" rev-list --count HEAD..origin/main) commit(s) behind; fast-forwarding"
    git -C "$CLONE" merge --quiet --ff-only origin/main || die "fast-forward failed in $CLONE"
    for pkg in $LOCKFILE_PACKAGES; do
      [ -d "$CLONE/$pkg/node_modules" ] \
        && git -C "$CLONE" diff --quiet "$head" "$latest" -- "$pkg/package-lock.json" && continue
      say "lockfile changed or node_modules missing in $pkg — npm ci"
      (cd "$CLONE/$pkg" && npm ci --no-audit --no-fund >/dev/null) || die "npm ci failed in $CLONE/$pkg"
    done
  fi
  [ "$(git -C "$CLONE" rev-parse HEAD)" = "$latest" ] || die "the scheduler clone still isn't at origin/main"
  say "scheduler clone is at the latest origin/main: $(git -C "$CLONE" log -1 --format='%h %s' | cut -c1-80)"
}

# ---- per agent ----------------------------------------------------------------

# Pids of any run of the agent: the scheduled wrapper, a hand run, and claude itself.
run_pids() {
  {
    pgrep -f "agent-scheduled-run\.sh $1\$" || true
    pgrep -f "agent-worktree\.sh run $1 " || true
    pgrep -f "claude --agent $1 " || true
  } | sort -u
}

stop_agent() {
  if launchctl bootout "$domain/com.nyc311.agent.$1" 2>/dev/null; then
    say "$1: schedule unloaded"
  else
    say "$1: schedule wasn't loaded"
  fi
  pids=$(run_pids "$1" | tr '\n' ' ')
  if [ -n "${pids% }" ]; then
    # shellcheck disable=SC2086
    kill $pids 2>/dev/null || true
    sleep 2
    left=$(run_pids "$1" | tr '\n' ' ')
    # shellcheck disable=SC2086
    [ -n "${left% }" ] && kill -9 $left 2>/dev/null || true
    say "$1: killed the run in progress (pids ${pids% }); a kept worktree is pruned after 7 days or by: scripts/agent-worktree.sh rm <name>"
  fi
}

start_agent() {
  out=$(/bin/sh "$installer" install "$1" 2>&1) || die "$1: install failed: $out"
  path=$(plutil -extract ProgramArguments.1 raw -o - "$HOME/Library/LaunchAgents/com.nyc311.agent.$1.plist" 2>/dev/null)
  case "$path" in "$CLONE"/*) : ;; *) die "$1: plist runs '$path', not the scheduler clone" ;; esac
  launchctl print "$domain/com.nyc311.agent.$1" >/dev/null 2>&1 || die "$1: installed but launchd didn't load it"
  say "$1: started — ${out#*— }"
  if grep -qE '^TEAM_CHAT_ENV=' "$schedules/$1.env" && ! grep -q "^\[$1\]" "$HOME/.nyc-311/credentials" 2>/dev/null; then
    say "WARN $1: no [$1] section in ~/.nyc-311/credentials, so its runs can't sign in to Team Chat"
  fi
}

status_agent() {
  if launchctl print "$domain/com.nyc311.agent.$1" >/dev/null 2>&1; then loaded=loaded; else loaded="not loaded"; fi
  path=$(plutil -extract ProgramArguments.1 raw -o - "$HOME/Library/LaunchAgents/com.nyc311.agent.$1.plist" 2>/dev/null || echo "no plist")
  running=$(run_pids "$1" | head -1)
  printf '%-26s %-11s %-9s %s\n' "$1" "$loaded" "${running:+running}" "$path"
}

case "$sub" in
  start)
    ensure_latest
    resolve_agents
    for a in $agents; do start_agent "$a"; done ;;
  stop)
    resolve_agents
    for a in $agents; do stop_agent "$a"; done ;;
  restart)
    # Check first, so a stale clone never leaves the team stopped.
    ensure_latest
    resolve_agents
    for a in $agents; do stop_agent "$a"; done
    for a in $agents; do start_agent "$a"; done ;;
  status)
    resolve_agents
    for a in $agents; do status_agent "$a"; done ;;
  check)
    ensure_latest ;;
  *) die "$usage" ;;
esac
