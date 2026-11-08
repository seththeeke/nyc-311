# AWS cost · Nov 8

Month to date: $16.05 · forecast ~$80.29 ($16.05 MTD + $64.24 remaining-days forecast) against the $30 goal ⚠️ (above October's $52.80)
Since the last report: no open `cost/` PRs to tend (none existed yet). Landed one change: two genuinely-unused Requests-table GSIs removed.

| Service | MTD | $/day (8d) | Trend |
|---|---|---|---|
| CodeBuild | $9.40 | $1.17 | spiky — tracks pipeline execution count (~53 executions in 8 days, many `Cancelled` by SUPERSEDED mode, each still burns a Synth LARGE build) |
| AWS CodePipeline | $3.41 | $0.43 | tracks execution count |
| Amazon DynamoDB | $1.31 | $0.16 | writes 86% of it; two dead GSIs just removed (PR #183) |
| Amazon S3 | $0.63 | $0.08 | request-driven, flat |
| Amazon Route 53 | $0.50 | $0.06 | mostly the Nov-1 hosted-zone fee (fixed) |
| AWS Secrets Manager | $0.17 | $0.02 | flat |

Experiments: none open — this change isn't an experiment (deterministic index removal, not a traffic bet), so no judge date; I'll confirm the drop in the normal weekly read.

**This run:** Landed [#183](https://github.com/seththeeke/nyc-311/pull/183) (closes [#182](https://github.com/seththeeke/nyc-311/issues/182)): removes the `gsi2-status` and `gsi3-location` GSIs from the `Requests` table. Both were `ProjectionType.ALL` and stamped on nearly every Request write, but `grep` across the whole codebase found zero queries against either index — and `docs/3-order-ingestion.md` §6 confirms the one planned `gsi2-status` consumer (a backfill job) was explicitly descoped ("accept the gap"). CloudWatch shows 682,802 WCU burned on these two indexes over the last 8 days for zero reads (~85,350/day) — **~$1.60/month** at today's volume, growing with ingestion (42,000+ Requests and climbing). `gsi1-external-key` (the real dedup query) and `gsi4-poller-metrics` (the real public-API query) are untouched. Build/lint/test:coverage green in `backend/` (1577 tests) and `cdk/` (450 tests, 100% coverage); `cdk synth` clean.

I re-checked CodeBuild per memory's lessons (don't re-propose compute downsizing — reliability-tested; npm caching too small) — nothing new there this week. No open `cost/` PRs existed to tend, and no experiments were due for judgment.

**Next:** CodeBuild is still the dominant line and is driven by raw execution volume, not compute sizing — worth a closer look at whether `Cancelled` executions (superseded mid-Synth by a rapid-fire push) are burning full builds that never produce anything, and whether anything safe can be done about that without weakening the SUPERSEDED-mode guarantee. Also worth re-checking Orders table's two GSIs (both appear genuinely used, lower priority than Requests was) once the DynamoDB line settles post-#183.

Tools: 2/8 Cost Explorer calls used (service+day MTD, monthly forecast). `cloudwatch get-metric-data` (per-table and per-table+GSI `ConsumedWriteCapacityUnits`), `dynamodb list-tables`, `codepipeline list-pipelines`/`list-pipeline-executions` used for drill-down (not CE, no cap). No failed calls.
