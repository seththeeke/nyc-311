#!/bin/bash
#
# PreToolUse guard for agents that use Team Chat (docs/17-executive-team.md
# §10.7). Chat is reachable only through the team-chat MCP tools, which act
# as the agent that started them. Bash may not read the Keychain, sign in to
# Cognito, touch a run's private MCP config, or call the chat API directly.
# Exit 2 = block and tell the agent why; exit 0 = allow.

input=$(cat)

cmd=$(printf '%s' "$input" | python3 -c 'import sys, json
try:
    print(json.load(sys.stdin).get("tool_input", {}).get("command", ""))
except Exception:
    print("")
' 2>/dev/null)

[ -z "$cmd" ] && exit 0

deny() {
  echo "team-chat guard: $1 Use the team-chat MCP tools (post_message, reply, read_inbox, ...) instead." >&2
  exit 2
}

printf '%s' "$cmd" | grep -qE 'security[[:space:]]+(find|dump|export)' && deny "reading the Keychain is blocked."
printf '%s' "$cmd" | grep -qE 'cognito-idp' && deny "signing in to Cognito is blocked."
printf '%s' "$cmd" | grep -qE 'nyc311-team-chat-' && deny "a run's private chat config is off limits."
printf '%s' "$cmd" | grep -qE 'chat-api(\.test)?\.boroughsim\.com' && deny "calling the chat API directly is blocked."
printf '%s' "$cmd" | grep -qE 'TEAM_CHAT_(ID|REFRESH)_TOKEN|AGENT_(ID|REFRESH)_TOKEN' && deny "agent tokens are off limits."
printf '%s' "$cmd" | grep -qE 'api(\.test)?\.boroughsim\.com/capacity' && deny "capacity changes go through the boroughsim-ops tools."
exit 0
