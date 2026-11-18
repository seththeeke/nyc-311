# AWS cost · Nov 18
Month to date: $31.68 (Nov 1-17) · forecast ~$84.78 against the $30 goal ⚠️
Since the last report (Nov 16): no new PRs merged yet — #233 (dead GSI) is up for Rex. CloudWatch's `VendedLog-Bytes` line is still elevated ($0.27-0.46/day since Nov 11) and still unexplained after deeper digging this run.

| Service | MTD | $/day (7d) | Trend |
|---|---|---|---|
| CodeBuild | $13.94 | $0.22 | flat, low since #212/#221 |
| AWS CodePipeline | $5.73 | $0.13 | flat, volume-driven |
| Amazon DynamoDB | $3.75 | $0.25 | steady — legit WCU |
| AmazonCloudWatch | $2.45 | $0.35 | now the top 7-day run-rate; cause still unfound |
| Amazon S3 | $1.66 | $0.08 | stable |
| Amazon SQS | $0.90 | $0.09 | steady |

**Experiments:** PR #221 (issue #220), merged 2026-11-14, judge 2026-11-21 — still too soon.

**Top lines:** **CloudWatch (now #1 by run-rate)** — spent the CE budget tracing `VendedLog-Bytes` ($0.27-0.46/day, ~0.5-1.25GB/day billed). Checked every real vended-log source this account has read access to: Step Functions execution logging (the only `/aws/vendedlogs/` log groups that exist) — measured actual `IncomingBytes` at only ~1-2MB over the whole 7 days, 1000x too small to explain the charge; no CloudTrail trail; no VPC Flow Logs; no WAF; no Route53 resolver query logging; no Bedrock model-invocation logging; Firehose error-log groups at 0 bytes; `describe-delivery-sources`/`describe-deliveries` both empty. **Not explained** — evidence points at something outside this account's visible log groups, or a billing/metric lag I can't resolve read-only. Carrying to next run rather than guessing.
**DynamoDB** — WCU is legit traffic (confirmed prior runs). New angle this run: PITR backup storage, billed by table size per environment regardless of traffic. `TeamChatTable` already makes PITR Prod-only; the other 10 domain tables didn't. Landed.
**CodeBuild/CodePipeline** — already cut hard (#212/#221); no new idea cleared the bar this run beyond what's in memory (ARM Synth declined by Rex 2026-11-16; V1 revert/step-merging already rejected, evidence unchanged).

**This run:** Filed [#242](https://github.com/seththeeke/nyc-311/issues/242) and landed [PR #243](https://github.com/seththeeke/nyc-311/pull/243): disables PITR on the 10 domain tables' Test replicas (`pointInTimeRecoveryEnabled: props.envName === "PROD"`), matching `deletionProtection`'s existing per-env pattern and `TeamChatTable`'s existing PITR pattern. Test tables total ~2.41GB of PITR-backed storage (`Requests-Test` 1.57GB largest) → ~$0.50/month, Prod untouched. `cdk/`: build/lint/483 tests/100% coverage, `cdk synth` confirmed Test=false/Prod=true in the synthesized templates. Flagged in the PR that `ddb-design.md`'s 2026-07-29 "PITR enabled" decisions predate the Test-gets-less-protection precedent, for Rex to weigh.

No open `cost/` PRs at run start (#233 from Nov 16 had already merged or was pending — tended: none needed changes).

**Next:** keep hunting CloudWatch's vended-log source (next idea: check other regions/linked accounts if access allows, or ask Rex/Seth if any out-of-band logging config exists); re-check #233/#221 outcomes next run.

Tools: 8/8 Cost Explorer calls used (MTD by day+service, 7-day by service, forecast, CloudWatch by usage type, VendedLog quantity+unit, VendedLog by operation). Non-CE AWS calls (dynamodb, logs, cloudwatch, stepfunctions, cloudtrail, route53resolver, guardduty, codebuild, cloudfront, wafv2, ec2) all succeeded.
