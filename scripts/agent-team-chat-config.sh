#!/bin/sh
#
# agent-team-chat-config.sh <agent> <TEST|PROD> <worktree>
#
# Signs <agent> in to Team Chat for one run and writes that run's MCP config
# (docs/17-executive-team.md §10.7). Prints the config's path. The tokens
# live only in that file, read by the team-chat MCP server, never in the
# agent's own environment; the caller deletes the file's directory when the
# run ends. Each run gets its own directory, so parallel runs never share or
# overwrite credentials.
#
# With AGENT_OPS_TOOLS set, the config also carries the boroughsim-ops MCP
# server (§12.4) on the same sign-in, for the COO's capacity tools.
#
# Needs: the agent's Cognito password in the login Keychain as a generic
# password, service "nyc311-team-chat-<Test|Prod>", account "<agent>". No AWS
# credentials: the client id comes from agent-schedules/team-chat.env, and
# the Cognito sign-in is an unauthenticated call.

set -eu

die() { printf 'agent-team-chat-config: %s\n' "$*" >&2; exit 1; }

agent=${1:-}
env_name=${2:-}
worktree=${3:-}
[ -n "$agent" ] && [ -n "$worktree" ] || die "usage: agent-team-chat-config.sh <agent> <TEST|PROD> <worktree>"
case "$env_name" in
  TEST) suffix=Test; chat_api_url=https://chat-api.test.boroughsim.com; ops_api_url=https://api.test.boroughsim.com ;;
  PROD) suffix=Prod; chat_api_url=https://chat-api.boroughsim.com; ops_api_url=https://api.boroughsim.com ;;
  *) die "environment must be TEST or PROD, got '$env_name'" ;;
esac
region=us-east-1
email="$agent@agents.boroughsim.com"
server="$worktree/backend/controller/mcp/teamChatMcpServer.ts"
ops_server="$worktree/backend/controller/mcp/boroughSimOpsMcpServer.ts"
tsx="$worktree/backend/node_modules/.bin/tsx"
[ -f "$server" ] || die "no MCP server at $server"
[ -x "$tsx" ] || die "no tsx at $tsx (run npm ci in backend/)"

password=$(security find-generic-password -s "nyc311-team-chat-$suffix" -a "$agent" -w 2>/dev/null) \
  || die "no Keychain password for $agent (service nyc311-team-chat-$suffix)"
# shellcheck disable=SC1091
. "$(dirname -- "$0")/agent-schedules/team-chat.env"
if [ "$env_name" = TEST ]; then client_id=${TEAM_CHAT_CLIENT_ID_TEST:-}; else client_id=${TEAM_CHAT_CLIENT_ID_PROD:-}; fi
[ -n "$client_id" ] || die "no agent client id for $env_name in scripts/agent-schedules/team-chat.env"

dir=$(mktemp -d "${TMPDIR:-/tmp}/nyc311-team-chat-XXXXXX")
chmod 700 "$dir"
umask 077

# The sign-in request goes through a file in the private directory, so the password never appears in a process's arguments.
AUTH_EMAIL=$email AUTH_PASSWORD=$password AUTH_CLIENT_ID=$client_id python3 -c '
import json, os
print(json.dumps({"AuthFlow": "USER_PASSWORD_AUTH", "ClientId": os.environ["AUTH_CLIENT_ID"],
                  "AuthParameters": {"USERNAME": os.environ["AUTH_EMAIL"], "PASSWORD": os.environ["AUTH_PASSWORD"]}}))
' >"$dir/auth.json"
auth=$(aws cognito-idp initiate-auth --no-sign-request --region "$region" --cli-input-json "file://$dir/auth.json" --output json) \
  || { rm -rf "$dir"; die "sign-in failed for $email"; }
rm -f "$dir/auth.json"

AUTH_RESULT=$auth CHAT_API_URL=$chat_api_url OPS_API_URL=$ops_api_url OPS_TOOLS=${AGENT_OPS_TOOLS:-} OPS_SERVER=$ops_server CLIENT_ID=$client_id REGION=$region SERVER=$server TSX=$tsx python3 -c '
import json, os
result = json.loads(os.environ["AUTH_RESULT"]).get("AuthenticationResult") or {}
if not result.get("IdToken") or not result.get("RefreshToken"):
    raise SystemExit("sign-in returned no tokens (a new password or MFA challenge?)")
servers = {"team-chat": {
    "command": os.environ["TSX"], "args": [os.environ["SERVER"]],
    "env": {"TEAM_CHAT_API_URL": os.environ["CHAT_API_URL"], "TEAM_CHAT_ID_TOKEN": result["IdToken"],
            "TEAM_CHAT_REFRESH_TOKEN": result["RefreshToken"], "TEAM_CHAT_CLIENT_ID": os.environ["CLIENT_ID"],
            "TEAM_CHAT_REGION": os.environ["REGION"]}}}
if os.environ.get("OPS_TOOLS"):
    servers["boroughsim-ops"] = {
        "command": os.environ["TSX"], "args": [os.environ["OPS_SERVER"]],
        "env": {"BOROUGH_SIM_API_URL": os.environ["OPS_API_URL"], "AGENT_ID_TOKEN": result["IdToken"],
                "AGENT_REFRESH_TOKEN": result["RefreshToken"], "AGENT_CLIENT_ID": os.environ["CLIENT_ID"],
                "AGENT_REGION": os.environ["REGION"]}}
print(json.dumps({"mcpServers": servers}, indent=2))
' >"$dir/mcp.json" || { rm -rf "$dir"; die "could not write the MCP config"; }

printf '%s\n' "$dir/mcp.json"
