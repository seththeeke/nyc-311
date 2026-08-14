# Things to Come Back To

Running list of items deliberately deferred — not forgotten, just not worth
blocking current work on. No fixed format required per entry; enough
context to pick it back up later is the only bar.

---

## Pipeline metrics and build-time optimization

The `Synth` CodeBuild step (`cdk/pipeline/Nyc311PipelineStack.ts`) feels
slow. Likely causes, unconfirmed:

- No dependency caching — `npm ci` runs fresh for both `backend/` and
  `cdk/` on every execution.
- No `computeType` override on `codeBuildDefaults.buildEnvironment`, so it
  defaults to the smallest (`BUILD_GENERAL1_SMALL`).
- `backend/` and `cdk/` lint/test/coverage run sequentially in one shell
  script, even though they're independent and could run in parallel
  CodeBuild actions.

Where to check before acting: CodePipeline console → `Nyc311Pipeline` →
an execution → `Synth` action → "Details" → CodeBuild build page →
"Phase details" for per-run timing; CloudWatch → `AWS/CodeBuild` namespace
→ `Duration` metric (by project) for the trend over time.

---

## Manual/forced polling controls for the ingestion Lambda

`Nyc311Poller-Test`/`Nyc311Poller-Prod` only ever compute their query
window from the stored cursor (`IngestionPollTriggerSchema` accepts any
payload and ignores its contents — 1-data-ingestion.md §2). That's fine
for the real EventBridge Scheduler trigger, but it means there's currently
no way to force/parameterize an on-demand poll — e.g. re-query a specific
window, or override the safety-lag floor for a one-off run — without
hand-editing the cursor item directly in DynamoDB (as done manually on
2026-08-14 to unstick `Requests-Test` after the live feed's publish lag
exceeded the original 24h `SAFETY_LAG_HOURS` assumption).

Worth designing real controls for this before it comes up again — e.g. an
optional trigger payload (`{ sinceOverride: "<timestamp>" }` or similar)
the controller validates and passes through to `pollNyc311`, rather than
reaching into DynamoDB by hand each time. Would also make
`test-scripts/1-ingestion-test.py` more useful for on-demand verification
instead of being at the mercy of wherever the real cursor happens to sit.
