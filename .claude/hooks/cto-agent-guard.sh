#!/bin/bash
#
# PreToolUse guard for cto-agent (docs/17-executive-team.md §16.4), wired in
# through the agent's frontmatter. Rex reviews and never changes code: no git
# writes, no branch checkouts (Pip may have the branch), and GitHub writes only
# to a PR's reviews, comments, labels and commit statuses, plus one merge: a
# squash merge, pinned to the head SHA, of an open, cto-approved devx/ PR
# (§16.2). Exit 2 blocks.

input=$(cat)
printf '%s' "$input" | python3 -c '
import json, re, shlex, subprocess, sys

try:
    cmd = json.load(sys.stdin).get("tool_input", {}).get("command", "")
except Exception:
    sys.exit(0)
if not cmd:
    sys.exit(0)

def deny(why):
    print(f"cto-agent guard: {why} Rex reviews and merges only: leave the change to Pip.", file=sys.stderr)
    sys.exit(2)

if re.search(r"--profile[= ]nyc311([\s\"\x27]|$)", cmd):
    deny("the admin nyc311 profile is blocked; use --profile nyc311-cto-agent.")

REPO = r"repos/seththeeke/nyc-311/"
WRITABLE = re.compile(r"^/?" + REPO + r"(pulls/\d+/reviews|issues/\d+/(comments|labels)|statuses/[0-9a-f]{7,40})$")
MERGE = re.compile(r"^/?" + REPO + r"pulls/(\d+)/merge$")

def check_merge(number, fields, used_input):
    if used_input or set(fields) != {"merge_method", "sha"}:
        deny("a merge takes exactly -f merge_method=squash -f sha=<head sha>.")
    if fields["merge_method"] != "squash":
        deny("Rex merges only with merge_method=squash.")
    try:
        out = subprocess.run(
            ["gh", "pr", "view", number, "--repo", "seththeeke/nyc-311", "--json", "headRefName,headRefOid,labels,state,isDraft"],
            capture_output=True, text=True, timeout=30, check=True,
        ).stdout
        pr = json.loads(out)
    except Exception:
        deny(f"could not look up PR #{number} to check the merge.")
    labels = {l.get("name") for l in pr.get("labels", [])}
    if not str(pr.get("headRefName", "")).startswith("devx/"):
        deny("Rex merges only Pip\x27s devx/ PRs.")
    if pr.get("state") != "OPEN" or pr.get("isDraft"):
        deny("Rex merges only open, non-draft PRs.")
    if "cto-approved" not in labels or "cto-escalated" in labels:
        deny("Rex merges only PRs labelled cto-approved and not cto-escalated.")
    if fields["sha"] != pr.get("headRefOid"):
        deny("the merge sha must be the PR\x27s current head SHA, the one Rex approved.")

for segment in re.split(r"\|\||&&|;|\||\n", cmd):
    try:
        words = shlex.split(segment)
    except ValueError:
        deny("could not parse the command.")
    while words and re.match(r"^\w+=", words[0]):
        words = words[1:]
    if not words:
        continue
    tool, args = words[0], words[1:]
    if tool == "git" and args:
        sub = args[0]
        if sub in {"push", "commit", "merge", "rebase", "reset", "switch", "branch", "cherry-pick", "revert", "tag", "am", "apply", "stash", "worktree", "clean"}:
            deny(f"git {sub} is blocked.")
        if sub == "checkout" and "--detach" not in args:
            deny("check out a PR only as git checkout --detach FETCH_HEAD.")
    if tool == "gh" and args:
        sub = args[0]
        if sub == "issue" and len(args) > 1:
            action = args[1]
            if action in {"list", "view", "comment"}:
                continue
            if action == "edit":
                rest = args[2:]
                labels = [rest[i + 1] for i, a in enumerate(rest[:-1]) if a == "--add-label"]
                flags = [a for a in rest if a.startswith("-")]
                if labels == ["cto-escalated"] and all(f in {"--add-label", "--repo", "-R"} for f in flags):
                    continue
            deny(f"gh issue {action} is blocked; Rex only reads, comments on and escalates issues.")
        if sub in {"issue", "repo", "release", "label", "workflow", "run", "secret", "variable", "auth"} and args[:2] != ["auth", "status"]:
            deny(f"gh {sub} is blocked.")
        if sub == "pr" and len(args) > 1:
            action = args[1]
            if action not in {"list", "view", "diff", "checks", "comment", "edit"}:
                deny(f"gh pr {action} is blocked.")
            if action == "edit":
                rest = args[2:]
                labels = [rest[i + 1] for i, a in enumerate(rest[:-1]) if a == "--add-label"]
                flags = [a for a in rest if a.startswith("-")]
                if not labels or any(l not in {"cto-approved", "cto-escalated"} for l in labels) or any(f not in {"--add-label", "--repo", "-R"} for f in flags):
                    deny("gh pr edit may only --add-label cto-approved or cto-escalated.")
        if sub == "api":
            rest = args[1:]
            method = None
            path = None
            writes = False
            used_input = False
            fields = {}
            i = 0
            while i < len(rest):
                a = rest[i]
                if a in {"-X", "--method"} and i + 1 < len(rest):
                    method = rest[i + 1].upper(); i += 2; continue
                if a.startswith("--method="):
                    method = a.split("=", 1)[1].upper()
                elif a in {"-f", "-F", "--field", "--raw-field", "--input"}:
                    writes = True
                    if a == "--input":
                        used_input = True
                    elif i + 1 < len(rest):
                        key, _, value = rest[i + 1].partition("=")
                        fields[key] = value
                    i += 2; continue
                elif a in {"-H", "--header", "-q", "--jq", "-t", "--template", "--hostname", "--cache", "-p", "--preview"}:
                    i += 2; continue
                elif not a.startswith("-") and path is None:
                    path = a
                i += 1
            if path is None or path == "graphql":
                deny("that gh api call is blocked.")
            if not path.lstrip("/").startswith(REPO):
                deny("gh api is limited to repos/seththeeke/nyc-311.")
            method = method or ("POST" if writes else "GET")
            merge = MERGE.match(path.split("?")[0])
            if merge and method == "PUT" and "?" not in path:
                check_merge(merge.group(1), fields, used_input)
                continue
            if "/merge" in path:
                deny("the only merge allowed is gh api -X PUT repos/seththeeke/nyc-311/pulls/<n>/merge.")
            if method != "GET":
                if method != "POST" or not WRITABLE.match(path.split("?")[0]):
                    deny(f"{method} {path} is blocked; Rex writes only reviews, comments, labels and statuses.")
sys.exit(0)
'
