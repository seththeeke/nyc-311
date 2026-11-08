# Grimble's memory

## Savings agenda
- (none yet)

## Experiments
| PR | Merged | Baseline $/day | Expected | Judge date | Result |
|---|---|---|---|---|---|

## Shipped savings

## Lessons
- 2026-11-07: don't re-propose shrinking Synth's CodeBuild compute. It went
  SMALL→MEDIUM (Aug 26)→LARGE (Aug 28) after Vitest's RPC teardown timed
  out under-resourced (issue #9); same reason the two MEDIUM gate steps
  (BrowserSmokeTestsTest, IntegrationTests{Test,Prod}) stay MEDIUM, per
  their own code comments. Reliability-proven, not just a guess.
- 2026-11-07: npm caching in the Synth CodeBuild step is real but small.
  Issue #9 measured `npm ci` across all 4 packages at ~15-20s of a ~200s
  BUILD phase (re-confirmed via CodeBuild logs 2026-11-07) — too little to
  justify an S3-cache bucket + buildspec change for ~$1/month. Don't
  re-propose without a bigger number behind it.
- 2026-11-07: DynamoDB WriteRequestUnits were 1.74M/week (86% of that
  line); CloudWatch table-level sums for Orders/Requests (Prod+Test) only
  covered ~700k — the gap is likely GSI write amplification on those same
  tables, not a separate culprit. Looks tied to core order-lifecycle
  simulation, not waste. Next run: read `dao/order`/`dao/request`'s GSI
  writes before touching this.
