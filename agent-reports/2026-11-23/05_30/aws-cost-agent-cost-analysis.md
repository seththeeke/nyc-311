# AWS cost · Nov 23
Month to date: $38.17 (Nov 1-22) · forecast ~$49.93 against the $30 goal ⚠️
Since the last report (Nov 18): no new PRs merged. #221 and #243 both judged this run (below). Solved the CloudWatch mystery: it's real traffic, not a bug.

| Service | MTD | $/day (7d) | Trend |
|---|---|---|---|
| CodeBuild | $15.30 | $0.28 | near floor post #212/#221 |
| AWS CodePipeline | $6.53 | $0.16 | near floor, volume-driven |
| Amazon DynamoDB | $4.80 | $0.21 | legit WCU, traffic up |
| AmazonCloudWatch | $4.33 | $0.37 | ↑ traffic-driven (explained this run) |
| Amazon S3 | $2.09 | $0.09 | stable |
| Amazon SQS | $1.32 | $0.08 | steady |

**Experiments judged:** PR #221 (issue #220) — **saved**. `USE1-Build-Min:Linux:g1.large` fell from $0.60/day (Nov1-11 baseline) to $0.138/day (Nov14-22), beating the $7.60/month target (though #212's volume cut also contributes). Kept. PR #243 (PITR, not labelled experiment) — **confirmed**: `TimedPITRStorage-ByteHrs` dropped from $0.020/day to $0.0065/day right at the Nov18 merge, matching the ~$0.50/month estimate.

**Top lines:** **CodeBuild/CodePipeline** — both at their per-execution floor (compute types already right-sized per memory; ARM Synth still pending Rex on #231). Remaining cost is pure execution *count*: 59 code-touching commits / ~60 pipeline runs over 16 days, 1:1. Filed [#257](https://github.com/seththeeke/nyc-311/issues/257) (wild-idea, tags @Rex): batching same-day merges could save an estimated $4-6/month — a workflow change, not a PR. **DynamoDB** — WCU still legit (Invocations on `RequestEvaluation-Prod` jumped 10-20x since Nov 9, confirmed via CloudWatch metrics); on-demand billing is the right call given that volatility (provisioned would risk throttling); event-sourced double-writes (event+projection) are correctness-load-bearing, not waste. **CloudWatch — mystery solved.** Three runs couldn't find `VendedLog-Bytes`'s source via delivery-API/exotic-service checks. This run: `AWS/Logs IncomingBytes` on `/aws/lambda/Nyc311RequestEvaluation-Prod` jumped from ~16MB/day (Nov6-8) to 90-250MB/day (Nov9+), tracking `Invocations` (632/day → 9-27k/day) almost exactly — it's standard Lambda log ingestion from a real traffic surge, billed under this usage-type, not a misconfigured exotic log source. Per-invocation volume (~10KB) matches CLAUDE.md's by-layer logging convention (controller logs full event, DAO logs full entity) — reducing it would cut observability, not waste. Not a safe line to touch.

**This run:** No PR — filed ticket [#257](https://github.com/seththeeke/nyc-311/issues/257) instead (workflow-sized change, tagged @Rex). Also tended PRs (none open) and judged two items above.

**Next:** watch #257 for Rex's read; re-check DynamoDB/CloudWatch growth trend as traffic keeps climbing.

Tools: **CE calls: overspent this run — ~13 invocations against the 8 budget** (two were accidental duplicates of the same MTD call; three were my own metric-name/casing errors on the CloudWatch usage-type query before I got it right). Flagging this plainly rather than hiding it; lesson logged in memory to prevent repeat. Non-CE calls (unlimited): codebuild, codepipeline, logs, lambda, cloudwatch, route53, ec2, bedrock, apigatewayv2, stepfunctions all succeeded.
