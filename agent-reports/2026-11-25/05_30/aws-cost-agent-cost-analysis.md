# AWS cost · Nov 25
Month to date: $40.91 (Nov 1-24) · forecast $49.56 against the $30 goal ⚠️
Since the last report (Nov 23): #231 (ARM Synth) and #257 (batch merges) both declined by Rex — no change landed since. CloudWatch has overtaken the pipeline as the #1 *recurring* daily line (it doesn't drop to ~$0 on no-commit days); this run ships the first move against it.

| Service | MTD | $/day (7d) | Trend |
|---|---|---|---|
| CodeBuild | $15.51 | $0.22 | floor on commit days, $0 otherwise |
| AWS CodePipeline | $6.66 | $0.13 | floor on commit days, $0 otherwise |
| Amazon DynamoDB | $5.16 | $0.20 | steady, traffic-driven |
| AmazonCloudWatch | $5.02 | $0.37 | **#1 on no-commit days**, VendedLog-Bytes |
| Amazon S3 | $2.24 | $0.08 | stable |
| Amazon SQS | $1.47 | $0.08 | steady |

Experiments: PR #267 (issue #266) — baseline `VendedLog-Bytes` ~$0.29/day, expected $2-5/mo, judge 2026-12-02.

Top lines: **CodeBuild/CodePipeline** — both at their per-execution compute floor (#212/#221 confirmed saved); ARM Synth (#231) and batching merges (#257) both declined by Rex this month, nothing new to try without a bigger number. **DynamoDB** — on-demand is correct given 10-20x day-to-day traffic swings; event+projection double-write is correctness-load-bearing; storage/TTL is near-zero already. **CloudWatch** — now the real #1 by run-rate on quiet days. Ruled out reducing log *volume* (CLAUDE.md's pessimistic-logging rule; this is real `RequestEvaluation` traffic, not waste) and ruled out every "exotic log source" theory live (API Gateway access logs off on all 8 APIs, no VPC Flow Logs/WAF/Route53Resolver/Logs-Delivery). New this run: **tiering** — `RequestEvaluation`'s log group (by far the fleet's largest, confirmed via `describe-log-groups`, with neither a metric filter nor a subscription filter per live checks) moved to `LogGroupClass.INFREQUENT_ACCESS`, which halves vended-log ingestion cost and keeps Logs Insights querying. Shipped as PR #267 (issue #266), `cost-experiment`, flagged explicitly for Rex: `logGroupClass` is immutable once set, so this forces a CloudFormation *replacement* of an already-deployed, explicitly-named log group — should fail cleanly on a same-name conflict (create-new-before-delete-old) but I can't confirm firsthand with read-only AWS access.

This run: landed PR #267 (issue #266, ~$2-5/month) on `cost/266-request-evaluation-log-ia`. Build/lint/test:coverage all green in `cdk/` (100% coverage, 507/507 tests); `cdk synth` confirmed only that one log group's class changed. No open `cost/` PRs otherwise to tend. Also discovered and backfilled: memory hadn't been committed since Nov 9 despite 5 shipped/judged items in between (#183, #193, #212/#221, #243) — reconstructed from the Nov 23 report and live GitHub state into memory + a new `history.md` detail file.

Next: if #267 confirms safe and saves, extend `LogGroupClass.INFREQUENT_ACCESS` to other high-volume, filter-free log groups (FanOut Lambdas are the next-largest). Also watch whether CloudWatch's `CW:AlarmMonitorUsage` ($0.073/day flat) is worth a look once VendedLog-Bytes is addressed.

Tools: CE calls used: 4 of 8 (DAILY cost-by-service, MONTHLY total, forecast, DAILY CloudWatch-by-usage-type). Non-CE calls (unlimited): logs (describe-log-groups/metric-filters/subscription-filters/delivery-*), apigatewayv2, ec2, wafv2, route53resolver, bedrock — all succeeded.
