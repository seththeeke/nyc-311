# AWS cost · Nov 9

Month to date: $17.13 · forecast $85.42 ($17.13 MTD + $68.29 CE forecast) against the $30 goal ⚠️
Since the last report: PR #183 (Requests table's two dead GSIs) merged overnight. Landed one new change: a lifecycle rule on the pipeline's own artifact bucket, which had none and had grown unbounded since August.

| Service | MTD | $/day (9d) | Trend |
|---|---|---|---|
| CodeBuild | $9.92 | $1.10 | g1.large (Synth, LARGE) 54%, g1.medium (gate tests) 34%, g1.small 12% — all reliability-locked per memory, driven by execution volume |
| AWS CodePipeline | $3.60 | $0.40 | per-action-minute (V2); same volume driver as CodeBuild |
| Amazon DynamoDB | $1.43 | $0.16 | PR #183 merged ~03:00 UTC today, too soon to read in the bill |
| Amazon S3 | $0.76 | $0.08 | pipeline artifact bucket growing 640MB (Aug)→8.25GB (Nov 9), no lifecycle rule — fixed this run |
| Amazon Route 53 | $0.50 | $0.06 | fixed hosted-zone fee |
| AWS Secrets Manager | $0.22 | $0.02 | flat |

**This run:** Checked the week's cancelled (SUPERSEDED) pipeline executions: 4/5 sampled ran Synth to full completion before being cancelled downstream — confirmed, but AWS's SUPERSEDED mode only cancels between stages, not mid-stage, so this isn't fixable without changing execution volume itself (not a safe single-run change). Also confirmed Orders table's `gsi1-stage-sla` and `gsi2-assigned-operator` are both genuinely queried in code (`orderSchedulingService`, `orderDao.getOrdersByOperator`) — ruling out further action there.

Landed [#193](https://github.com/seththeeke/nyc-311/pull/193) (closes [#192](https://github.com/seththeeke/nyc-311/issues/192)): the CodePipeline's auto-created S3 artifact bucket had no lifecycle rule — every execution's Source/Synth/action objects, needed only for the minutes that execution runs, were kept forever. `cloudwatch get-metric-statistics` showed it growing from 640MB in August to 8.25GB by Nov 9, accelerating (~170-190MB/day lately). Added one `addLifecycleRule` call on the existing bucket in place (via `pipeline.pipeline.artifactBucket`) — no new bucket, no replacement, no pipeline-behavior change: objects expire after 14 days, their resulting noncurrent versions after 1 more. Expected saving is modest now (~$0.15-0.30/month) but caps growth that would otherwise compound every month indefinitely. `cdk/`: build, lint, 456 tests at 100% coverage, and `cdk synth` all green; confirmed the rule in the synthesized template.

No open `cost/` PRs existed to tend this run (#183 merged before this run started). No experiments were due for judgment — #183 isn't labelled `cost-experiment` (deterministic), and I'll read its effect once it's had more than a few hours in the bill.

**Next:** CodeBuild/CodePipeline (79% of spend) are both volume-driven, not compute-sizing-driven, and reducing execution count would mean changing how often code merges to main — out of scope for a single safe change. Will re-check DynamoDB's post-#183 trend and the artifact-bucket size trend next run.

Tools: 4/8 Cost Explorer calls used (MTD by day+service, monthly forecast, CodeBuild USAGE_TYPE, CodePipeline USAGE_TYPE). `cloudwatch`, `codebuild`, `codepipeline`, `s3api` calls (no CE cap) for drill-down. No failed calls.
