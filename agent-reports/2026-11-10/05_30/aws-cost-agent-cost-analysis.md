# AWS cost · Nov 10
Month to date: $20.00 · forecast $91.67 ($20.00 MTD + $71.67 CE forecast) against the $30 goal ⚠️
Since the last report: PR #193 (artifact-bucket lifecycle) still open, approved by Rex, waiting on Seth. DynamoDB is already trending down post-PR #183.

| Service | MTD | $/day (7d) | Trend |
|---|---|---|---|
| CodeBuild | $11.47 | $1.23 | steady — volume-driven (72 executions/10d), Synth 2-3 LARGE-min/run regardless of size |
| AWS CodePipeline | $4.34 | $0.47 | steady — per-action-minute (V2), same execution-count driver |
| Amazon DynamoDB | $1.54 | $0.13 | ↓ Nov9 $0.085→Nov10 $0.041/day vs ~$0.18/day pre-PR#183 (merged Nov9 03:00 UTC) |
| Amazon S3 | $0.96 | $0.10 | artifact bucket still growing; lifecycle fix (#193) not yet merged |
| Amazon Route 53 | $0.50 | — | flat hosted-zone fee, one zone, nothing to trim |
| AWS Secrets Manager | $0.25 | $0.02 | flat |

**Experiments:** none in flight (no PR of mine is labelled `cost-experiment`).

**Top lines:** **CodeBuild** — measured real Synth builds at 2-3 min on LARGE regardless of what changed (CloudWatch logs); backend+customer/backend's own npm-ci+lint+test:coverage take ~18s combined, too little to gate by changed-package to justify the risk (no git history in the CodeBuild workspace — CodePipeline delivers a zip, not a clone). ARM/Graviton for Synth: blocked, same reason MEDIUM/LARGE sizing is already locked (issue #9 OOM history). Merging the two parallel MEDIUM gate steps (BrowserSmokeTestsTest, IntegrationTestsTest) saves only ~$0.08-0.10/month (one provisioning overhead) for real risk to their independent pass/fail signal — not worth it. **CodePipeline** — $0.002/action-minute, rounded up per action; 2272 action-minutes/10d track action *count* (~20-30/execution), not duration, so compute sizing is irrelevant here; reducing action count would mean touching CDK Pipelines' own asset-publishing internals. **DynamoDB** — already falling from PR #183; no new idea needed this run.

**This run:** Filed and landed [#211](https://github.com/seththeeke/nyc-311/issues/211)/[PR #212](https://github.com/seththeeke/nyc-311/pull/212): the pipeline's V2 push trigger excluded `docs/**`, `agent-web-app/**`, `agent-reports/**`, `.claude/**` but not `scripts/agent-*` (Mac-mini agent automation, never read by any package's build/test/deploy — confirmed by grep). 7-day git log showed 5 of ~50 commits touched only those paths; each still ran the full pipeline. Added them to `filePathsExcludes`; `scripts/publish-coverage.js` (the one `scripts/` file the pipeline reads) stays included. `cdk/`: build, lint, 460/460 tests at 100% coverage, `cdk synth` all green. Expected ~$4/month, not an experiment (deterministic, same mechanism as #112).

Tended PR #193: Rex approved it (`cto-agent:approved`), nothing further for me to do; still waiting on Seth.

**Next:** CodeBuild/CodePipeline remain volume-driven; the real lever is merge cadence, a workflow change outside a single PR. Will re-check #193's bucket-size trend and #211's execution-count drop next run.

Tools: 5/8 Cost Explorer calls used (2 failed on a metric-name typo, no charge presumed; MTD by day+service, forecast, CodeBuild USAGE_TYPE, CodePipeline USAGE_TYPE succeeded). `codebuild`/`codepipeline`/`logs`/`route53` calls (no CE cap) for drill-down. No failed AWS calls outside those two CE typos.
