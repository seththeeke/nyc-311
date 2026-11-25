---
package: tooling
score: 51
previous: none
---
# tooling · 51/100

| Audit | Score |
|---|---|
| Complexity | 12/20 |
| Pattern sprawl | 9/15 |
| Consistency | 9/15 |
| Divergence and duplication | 4/15 |
| Code smells | 9/15 |
| AI-friendliness | 8/20 |

**Verdict:** The agent tooling is 44 files and about 6,000 lines of shell, inline Python and prompt prose, with no test or lint for any of it. Rules are copied from file to file instead of shared, and the copies have drifted: in the package list three times, in the guards several times, and in the prompts since the configs last changed. Nothing fails when they disagree.

## Findings
1. **Package list hand-kept in 3 scripts** (Divergence): `agent-worktree.sh:50`, `agent-scheduled-run.sh:84`, `agent-team.sh:37`. Each copy has a "keep in sync" comment, and the lists have drifted three times, each time a bug (#95, #103, #175). The next new package needs the same three edits. [#263](https://github.com/seththeeke/nyc-311/issues/263)
2. **Guard hooks copied 3 ways, fixes not ported** (Pattern sprawl, Divergence): `gen-purpose-dev-guard.sh:48,53,59` catches `git -C … push`, `refs/heads/main` and `+ref` force pushes. `devx-agent-guard.sh:36` and `aws-cost-agent-guard.sh:46,51` don't. `aws-cost-agent-guard.sh:41` still checks `.claude/agent-reports`, a path 17f717b retired. 7 guards fail open on input they can't parse; 2 fail closed. No tests. [#264](https://github.com/seththeeke/nyc-311/issues/264)
3. **Prompts contradict the config** (AI-friendliness): `devx-agent.md:136` says "3+" open PRs, but `MAX_OPEN_PRS=5`. `cto-agent.md:4` says Rex runs "an hour after each of Pip's runs", which holds for 2 of his 8 slots. `CLAUDE.md:842,848` state cadences the `.env` files no longer have. `devx-agent.md:75-78` contradicts itself, and line 377 points to a section that doesn't exist. Four prompts are over 400 lines. [#265](https://github.com/seththeeke/nyc-311/issues/265)
4. **`agent-scheduled-run.sh` is 480 lines with no structure** (Complexity): it branches on KIND in four places (127, 325, 333-362, 448). `pick_cards` (260-299) defines a function inside a function and changes `wip` inside a piped subshell. The `eval` lookup of a per-mode value is copied 3 times (179, 186, 193).
5. **Each MCP server is wired through 3 renames and 4 files** (Divergence): `OPS_TOOLS` becomes `AGENT_OPS_TOOLS` (`agent-scheduled-run.sh:135`) and then `OPS_TOOLS` again (`agent-team-chat-config.sh:105`, one line carrying 25 env vars). The server blocks are copied 3 times (117-144), and the API URLs are written out twice (34-35, 94).
6. **Log lines are an untested contract** (AI-friendliness): `agent-web-app/server/source/runLogParser.ts:12-17` uses regexes to parse lines that `agent-scheduled-run.sh` writes as plain text (354-361, 435, 479). Rewording one silently breaks the agent monitor.
7. **Smaller copies and stale comments** (Divergence, Smells): the SCHEDULE parser exists twice (`agent-schedule-install.sh:46-74`, `agent-scheduled-run.sh:152-174`). The worktree-name format is parsed in 3 places. `agent-board.sh:6` cites a deleted script. `agent-report-commit.sh:78` treats "nothing new" as a push failure, which `agent-memory-commit.sh:68-71` does not.

## Since last time
First audit of tooling.
