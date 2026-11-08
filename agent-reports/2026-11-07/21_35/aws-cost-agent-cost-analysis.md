# AWS cost · Nov 7

Month to date: $11.89 · forecast $71.41 against the $30 goal ⚠️ (also above October's $52.80)
Since the last report: first run for this agent — no memory, no open `cost/` PRs, no prior report found.

| Service | MTD | $/day (7d) | Trend |
|---|---|---|---|
| CodeBuild | $6.60 | $0.94 | spiky, LARGE-compute Synth dominates |
| AWS CodePipeline | $2.46 | $0.35 | tracks CodeBuild execution count |
| Amazon DynamoDB | $1.26 | $0.18 | writes 95% of it, spiked Nov 6 |
| Amazon S3 | $0.57 | $0.08 | request-driven, not storage |
| Amazon Route 53 | $0.50 | $0.07 | mostly a Nov-1 hosted-zone fee (fixed) |
| AWS Secrets Manager | $0.18 | $0.03 | flat |

Experiments: none open.

This run: no change landed. I chased the two obvious CodeBuild levers first since it's over half the bill:
- **Compute-type downsizing** (Synth is LARGE, two gates are MEDIUM): the pipeline's own code comments show this was already tried and reverted — Synth went SMALL→MEDIUM→LARGE in Aug 2026 after Vitest's RPC teardown timed out under-resourced; the two MEDIUM steps (BrowserSmokeTests, IntegrationTests) carry the same documented flake risk. Re-trying this would cost reliability, which the brief rules out.
- **npm dependency caching in Synth**: issue #9's own measurement (Sept 2026, re-confirmed via `codebuild batch-get-builds`/logs on today's Synth runs) found `npm ci` across all 4 packages costs only ~15-20s of the ~200s BUILD phase — real but "low priority," too small to justify the S3-cache bucket and buildspec change for maybe ~$1/month.
- Parallelizing the 4 packages' lint/test inside Synth's one shell looked promising on paper (~50% less wall time) but reintroduces exactly the CPU contention that forced LARGE compute in the first place — too risky to ship blind.

DynamoDB's WriteRequestUnits are 1.74M/week (86% of that line); table-level CloudWatch sums for Orders/Requests (Prod+Test) only account for ~700k of it, so GSI write amplification on those tables likely explains the rest — looks tied to core order-lifecycle simulation, not waste, so I didn't touch it without reading every DAO's GSI writes first.

Next: read `dao/order` and `dao/request`'s GSI writes to check for an unnecessary GSI or duplicate write before ruling DynamoDB out; also worth quantifying S3's 414k GET / 64k PUT requests/week (small dollars, odd volume).

Tools: 8/8 Cost Explorer calls used (service+day, forecast, CodeBuild/CodePipeline/S3×2/DynamoDB USAGE_TYPE, one failed RESOURCE_ID attempt). `codebuild`, `logs`, `cloudwatch`, `dynamodb list-tables` calls (not CE) used for drill-down, no failures.
