# shellcheck shell=sh
#
# agent-packages.sh — the one list of npm packages the agent tooling installs
# (npm ci) and CoW-clones (node_modules) per checkout. Sourced, never run, by
# agent-worktree.sh, agent-scheduled-run.sh and agent-team.sh (#263). Add a
# new package here and nowhere else; three hand-kept copies drifted three
# times (#95, #103, #175).
#
# rollup-coverage.js and publish-coverage.js keep their own lists on purpose:
# agent-web-app is outside the coverage rollup (CLAUDE.md §5.5).

AGENT_NODE_PACKAGES='. web-app backend cdk customer/backend agent-web-app'
