#!/bin/bash
#
# PreToolUse guard for cpo-agent (docs/17-executive-team.md §17.2), wired in
# through the agent's frontmatter. Celestine never changes code: Write and
# Edit only her memory file, her saved queries (queries/<name>.sql, §17.11)
# or /tmp, no git writes, no PRs, no AWS, and gh writes only on her own
# cpo-agent issues. Exit 2 blocks.

input=$(cat)
printf '%s' "$input" | CPO_PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$PWD}" python3 -c '
import json, os, re, shlex, subprocess, sys

try:
    data = json.load(sys.stdin)
except Exception:
    sys.exit(0)
tool = data.get("tool_name", "")
args = data.get("tool_input", {}) or {}

def deny(why):
    print(f"cpo-agent guard: {why} Celestine files tickets; she never changes code.", file=sys.stderr)
    sys.exit(2)

if tool in ("Write", "Edit"):
    project = os.path.realpath(os.environ["CPO_PROJECT_DIR"])
    path = os.path.realpath(os.path.join(project, args.get("file_path", "")))
    memory_dir = os.path.join(project, ".claude", "agent-memory", "cpo-agent")
    queries_dir = os.path.join(memory_dir, "queries")
    if path == os.path.join(memory_dir, "MEMORY.md") or path.startswith("/tmp/") or path.startswith("/private/tmp/"):
        sys.exit(0)
    if os.path.dirname(path) == queries_dir and re.fullmatch(r"[a-z0-9][a-z0-9-]*\.sql", os.path.basename(path)):
        sys.exit(0)
    deny("writing " + str(args.get("file_path")) + " is blocked; only her memory file, queries/<name>.sql and /tmp.")

if tool != "Bash":
    sys.exit(0)
cmd = args.get("command", "")
REPO = "seththeeke/nyc-311"

for target in re.findall(r">>?\s*([^\s;&|]+)", cmd):
    if not (target.startswith("/tmp/") or target.startswith("/private/tmp/") or target == "/dev/null" or target.startswith("&")):
        deny("redirecting output to " + target + " is blocked; only /tmp.")

def own_issue(number):
    try:
        out = subprocess.run(["gh", "issue", "view", number, "--repo", REPO, "--json", "labels", "--jq", "[.labels[].name] | index(\"cpo-agent\") != null"], capture_output=True, text=True, timeout=30)
    except Exception:
        return False
    return out.stdout.strip() == "true"

for segment in re.split(r"\|\||&&|;|\||\n", cmd):
    try:
        words = shlex.split(segment)
    except ValueError:
        deny("could not parse the command.")
    while words and re.match(r"^\w+=", words[0]):
        words = words[1:]
    if not words:
        continue
    head, rest = words[0], words[1:]
    if head in {"aws", "cdk", "npx", "npm", "node", "tsx", "curl", "wget", "security", "rm", "mv", "cp", "tee", "chmod"}:
        deny(f"{head} is blocked.")
    if head == "git" and (not rest or rest[0] not in {"log", "show", "diff", "status", "grep", "ls-files", "rev-parse", "blame"}):
        deny("git is read-only for her.")
    if head == "gh" and rest:
        sub = rest[0]
        if sub == "label" and rest[1:2] in (["list"], ["create"]):
            continue
        if sub in {"--version"} or rest[:2] == ["auth", "status"]:
            continue
        if sub != "issue":
            deny(f"gh {sub} is blocked; only gh issue.")
        action = rest[1] if len(rest) > 1 else ""
        if action in {"list", "view"}:
            continue
        if action == "create":
            labels = [rest[i + 1] for i, a in enumerate(rest[:-1]) if a in ("--label", "-l")]
            if "cpo-agent" not in ",".join(labels).split(","):
                deny("her issues carry the cpo-agent label.")
            continue
        if action in {"comment", "edit", "close", "reopen"}:
            number = next((a for a in rest[2:] if re.fullmatch(r"#?\d+", a)), None)
            if number is None or not own_issue(number.lstrip("#")):
                deny("she may only change her own cpo-agent issues.")
            if action == "edit" and any(a in ("--remove-label", "--add-assignee", "--milestone") for a in rest):
                deny("that issue edit is blocked.")
            continue
        deny(f"gh issue {action} is blocked.")
sys.exit(0)
'
