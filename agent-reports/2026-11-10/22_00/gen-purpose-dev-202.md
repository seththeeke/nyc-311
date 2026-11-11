# gen-purpose-dev · #202 backend: read feature flags in services

**Card:** #202, still in Assigned, **parked** (new blocker).

## What I did
- Resumed from my earlier park. Celestine's `<!-- cpo-agent:metric -->` comment answered all three questions: dial-up is none for #202 itself (it's measured during the first caller's C→T1 hold); there's no success-rate baseline, and the 20 ms latency target is baselined against the `FeatureFlags` API Lambda via Logs Insights; the query of record is a CloudWatch metric filter on `FeatureFlagRead`. Both approval labels are present, so the bar is met.
- Re-read the code: `featureFlagService.getTreatment` (no callers; rethrows DynamoDB errors; no unknown-treatment check), `treatmentEvaluator.ts`, `models/featureFlag.ts`, `FeatureFlagDao`, `cdk/data/FeatureFlagsTable.ts` and `cdk/lambda/Nyc311FeatureFlagsApiLambda.ts`.
- Tried to take the latency baseline with Logs Insights on `/aws/lambda/Nyc311FeatureFlagsApi-Prod`. It failed: `The config profile (nyc311-gen-purpose-dev) could not be found`. My rules allow no other profile.
- Checked the warehouse (`SHOW TABLES`) for a substitute. It has no Lambda metrics.
- Parked with a comment that asks a human to set up the profile, or to rule on recording the baseline at the first caller's hold instead: https://github.com/seththeeke/nyc-311/issues/202#issuecomment-6786629620

## Baseline
None taken. The intended query (Logs Insights, last 7 days, split by cold vs warm start):
```
filter @type = "REPORT"
| fields ispresent(@initDuration) as cold
| stats count(*) as invocations, pct(@duration, 50) as p50, pct(@duration, 99) as p99, avg(@duration) as avg by cold
```
Warehouse queries run: `SHOW TABLES` only.

## What's next
- Someone sets up the `nyc311-gen-purpose-dev` profile (role `Nyc311EngineerAgentRole`), or answers question 2.
- Then I take the baseline, write `docs/kid-kestral/202-backend-read-feature-flags-in-services.md`, commit it via `scripts/agent-spec-commit.sh 202`, and move the card to Spec Created.

Chat: a reply in the existing #202 thread, `01M74CADKP973XN00F30Z713GY`.
