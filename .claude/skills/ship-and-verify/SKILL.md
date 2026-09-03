---
name: ship-and-verify
description: Runs this project's full ship loop after a backend/ or cdk/ code change - build/lint/test/coverage for the affected package(s), a single commit and push to main, then polls Nyc311Pipeline every 15s reporting stage status until DeployTest succeeds or fails, then re-runs the relevant test-scripts/ script to verify the change actually works in Nyc311-Test. Use whenever a code change needs to be shipped and verified end-to-end, not just committed.
---

# Ship and Verify

Codifies the write → test → push → poll → verify loop.

## Steps

1. **Operational Loop (CLAUDE.md §2).** For every affected package
   (`backend/`, `cdk/`, or both): `npm run build`, `npm run lint`,
   `npm run test:coverage`. Fix and re-run until everything passes at
   ≥90% coverage per file. Never report done without having actually run
   these in this session.
2. **Commit and push.** Stage all outstanding changes as a single commit
   (CLAUDE.md §7 format: `[<feat>/<bugfi>] - <message>` — the
   `prepare-commit-msg` git hook prepends the `claude-default-agent:` /
   `<agent-name>:` prefix, no need to type it), then `git push origin main`.
   This triggers `Nyc311Pipeline`'s self-mutating CodePipeline.
3. **Poll the pipeline.** Run `poll_pipeline.py` (in this skill's
   directory) via the Monitor tool so its output streams live — it prints
   every stage's status every 15s (even when nothing changed, so the
   watcher knows it's alive), stops immediately if a stage for the
   triggered execution fails, and exits once `DeployTest` succeeds for
   that execution. Don't wait on `DeployProd` — it isn't gating.
4. **Verify.** Once `DeployTest` succeeds, run the relevant
   `test-scripts/` script (e.g. `1-ingestion-test.py`) against
   `Nyc311-Test` and report its actual result — pass or fail, with the
   real numbers.

Report progress as it happens rather than going silent for the whole
loop. Never take a mutating action against `Nyc311-Prod` as part of this
skill without calling it out and getting confirmation first, even
mid-loop — this skill's scope is Test verification only.
