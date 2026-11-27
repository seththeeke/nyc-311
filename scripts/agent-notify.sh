#!/bin/sh
#
# agent-notify.sh "<message>" — send <message> to the owner's phone as an
# iMessage from this Mac (Messages.app must be signed in).
#
# The recipient is NOTIFY_IMESSAGE_TO in a local, never-committed file:
# ~/.config/nyc311-agents/notify.env (AGENT_NOTIFY_CONFIG overrides), e.g.
#   NOTIFY_IMESSAGE_TO="+15551234567"
# AGENT_NOTIFY_DRY_RUN=1 prints the message instead of sending it.

set -u

die() { printf 'agent-notify: %s\n' "$*" >&2; exit 1; }

msg=${1:-}
[ -n "$msg" ] || die 'usage: agent-notify.sh "<message>"'

config=${AGENT_NOTIFY_CONFIG:-"$HOME/.config/nyc311-agents/notify.env"}
[ -f "$config" ] || die "no config at $config (set NOTIFY_IMESSAGE_TO there)"
# shellcheck disable=SC1090
. "$config"
to=${NOTIFY_IMESSAGE_TO:-}
[ -n "$to" ] || die "NOTIFY_IMESSAGE_TO is not set in $config"

if [ -n "${AGENT_NOTIFY_DRY_RUN:-}" ]; then
  printf 'agent-notify (dry run) to %s:\n%s\n' "$to" "$msg"
  exit 0
fi

# Recipient and text go in as argv, so no quoting of either reaches AppleScript.
/usr/bin/osascript - "$to" "$msg" <<'EOF' || die "Messages could not send to $to"
on run argv
  set recipient to item 1 of argv
  set body to item 2 of argv
  tell application "Messages"
    set svc to 1st account whose service type = iMessage
    send body to participant recipient of svc
  end tell
end run
EOF
