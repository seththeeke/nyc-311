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

---

## Publishing code coverage (GitHub badge or hosted report)

Discussed 2026-08-16. Not abnormal to want this — the question is just
which mechanism, since GitHub itself doesn't compute coverage.

Two realistic options:

- **GitHub badge via a third-party service** (Codecov, Coveralls) —
  ingests each package's `coverage-summary.json`/lcov output from a
  CodeBuild run. Familiar/clean-looking, but pulls in an external
  dependency and, for a private repo, often means a paid tier.
- **Host the reports on the app's own CloudFront** (favored) — the repo
  already has `cdk/web/WebsiteHosting.ts` + `WebsiteDeployment.ts` serving
  `web-app/`, and the local `npm run coverage:rollup` page (CLAUDE.md §8)
  already stitches the three packages' reports together. The pipeline's
  Synth step (or a new post-step) could sync each package's `coverage/`
  output — or just the rollup page — to the same S3 bucket after tests
  run, making it reachable at a URL with no third party. Still needs: a
  decision on whether that URL is public or gated somehow (the numbers
  aren't sensitive, but it's internal tooling, not site content, so it
  probably shouldn't be linked from the public SPA), and the actual
  pipeline wiring to do the sync + CloudFront invalidation.

---

## Poller is permanently capped — the ingestion window hasn't advanced in 6+ days

Confirmed 2026-08-16 via the ingestion-metrics dashboard (a real value of
it working as intended — this is exactly the kind of thing it's for): the
poller reports `records_ingested` at almost exactly `PER_RUN_RECORD_CAP`
(2000) on nearly every run, which read as suspiciously static. Checked the
real cursor and logs to find out why, rather than guessing:

- `Requests-Test`'s `CURSOR#NYC_311` item: `last_watermark` stuck at
  `2026-08-10T00:00:00`, `resume_offset` at 24,000 and climbing.
- `Nyc311Poller-Test` logs: 15 of the last 17 runs hit the 2000 cap
  exactly, with duplicates staying near-zero each time (not re-scanning —
  each run genuinely advances into new ground).

So resume-pagination itself works correctly — that closes out
`1-data-ingestion.md`'s previously-open "resumed pagination not yet
empirically re-verified" item, now confirmed. But the poll window opened
on Aug 10 has never once fully drained (`page.length < pageLimit` never
fires), so `last_watermark` has never advanced. This isn't a bug — it's a
real throughput mismatch: unfiltered NYC 311 volume (all complaint types,
per the project's ingestion scope) is well above what 2000 records / 6h
can drain, so the backlog is likely still growing, not shrinking. The
poller is not tracking anything close to real-time.

Not urgent to fix right now, but don't lose track of it — options
discussed, roughly in order of how much they change:
- Raise `PER_RUN_RECORD_CAP` (`backend/service/ingestion/nyc311PollerService.ts`).
- Poll more often than every 6h (`cdk/lambda/Nyc311PollerSchedule.ts`'s `POLL_INTERVAL`).
- A one-time manual catch-up run with a much higher cap, then drop back to
  steady-state settings once caught up.

Whichever direction, it's worth re-checking the cursor/logs the same way
afterward to confirm the window actually starts draining, not just
assuming the fix worked.
