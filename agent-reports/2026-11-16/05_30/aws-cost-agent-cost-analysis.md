# AWS cost · Nov 16
Month to date: $28.82 (Nov 1-16) · forecast $54.89 remaining ($83.71 total) against the $30 goal ⚠️
Since the last report (Nov 10): #212 (trigger excl.) and #221 (parallel Synth, judge 2026-11-21) both landed — CodeBuild/CodePipeline's 7-day $/day fell from $1.23/$0.47 to $0.34/$0.19. New: CloudWatch's `VendedLog-Bytes` usage type jumped from ~$0 to $0.32-0.48/day starting Nov 11, cause not yet found.

| Service | MTD | $/day (7d) | Trend |
|---|---|---|---|
| CodeBuild | $13.36 | $0.34 | ↓ sharply post #212/#221 |
| AWS CodePipeline | $5.38 | $0.19 | ↓ same, volume-driven |
| Amazon DynamoDB | $3.33 | $0.26 | steady — Orders/Requests WCU dominate (legit traffic) |
| AmazonCloudWatch | $1.72 | $0.25 | ↑ new since Nov 11, unexplained |
| Amazon S3 | $1.46 | $0.08 | artifact lifecycle (#193) working |
| Amazon SQS | $0.74 | $0.09 | steady |

**Experiments:** PR #221 (issue #220), merged 2026-11-14, judge 2026-11-21 — too soon to judge.

**Top lines:** **CodeBuild** — (1) ARM/Graviton for Synth at the *same* LARGE size (not smaller — sidesteps the 2026-08-28 OOM history, which was about size not architecture): real ~$1-2/month, but the only curated ARM Standard image is `:4.0` vs. x86's `:7.0` (different OS/toolchain), and a bad Synth change on this self-mutating pipeline risks the revert itself failing to deploy — filed as wild-idea ticket #231 for Rex, not a PR, given I can't execute a build to verify compatibility. (2) Full 4-way parallel Synth: rejected, reintroduces the CPU contention that forced LARGE. (3) S3 npm cache: ~$1/mo, too small (confirmed before). **CodePipeline** — reverting V2→V1 pricing would drop the ~$1/mo-per-pipeline floor, but loses `SUPERSEDED` cancellation (V1-only limitation), which already measurably caps CodeBuild minutes — net loss on the bigger line, rejected without a new PR. **DynamoDB** — Orders/Requests WCU (dominant: ~1.8M combined over 7.5d) is genuine app traffic, not waste. But `gsi3-location` on `Requests` was flagged in code as "remove once reached Prod" (#187, merged Nov 9) — confirmed zero writes, still deployed; landed its removal this run.

**This run:** Filed [#233](https://github.com/seththeeke/nyc-311/pull/233) (issue #232): removes the now-dead `gsi3-location` GSI from `Requests-{Prod,Test}` — ~0.62GB of unread `ALL`-projection storage, ~$0.15/month. `cdk/`: build/lint/466 tests/100% coverage, `cdk synth` clean. Deterministic, not an experiment. Also filed [#231](https://github.com/seththeeke/nyc-311/issues/231) (wild-idea, ARM Synth) for Rex.

No open `cost/` PRs to tend at run start (all prior ones merged or closed).

**Next:** root-cause CloudWatch's `VendedLog-Bytes` jump (traced to AWS/Logs IncomingBytes across ~20 log groups so far, none individually explains the daily shape — needs more targeted drill-down); judge PR #221 on 2026-11-21.

Tools: 5/8 Cost Explorer calls (MTD by day+service ×3 reuses, forecast, CloudWatch USAGE_TYPE). `dynamodb`/`cloudwatch`/`codebuild`/`cloudtrail`/`logs` calls (no CE cap) for drill-down, all succeeded.
