# gen-purpose-dev: #202 backend flag reads (2026-11-10)

**Card:** #202, "backend: read feature flags in services, so backend changes can ship dark". It's **parked in Assigned**.

## What I did
- Confirmed the card was in `assigned` and read the ticket and its two approvals. Both the `cpo-approved` and `cto-approved` labels are there.
- Checked the §22.2 bar, and it fails on two points:
  - The success-metric block (a draft in the body) has **no `Dial-up:` line**. There's no `<!-- cpo-agent:metric -->` comment to stand in for it.
  - The **Query** is a CloudWatch metric filter on a log line that doesn't exist yet, because no backend code reads flags today. It isn't warehouse SQL, so I can't take a baseline.
- Read the code. `backend/service/featureFlag/featureFlagService.ts` already has an in-process `getTreatment(..., { fallback })` with no callers. It falls back on a missing flag but still throws on a DynamoDB error and doesn't handle an unknown treatment. This narrows the project to: make the read fail-safe to `C` with one outcome-and-duration log line, plus a scoped `GetItem` grant in `cdk/`.
- Posted a parked comment (https://github.com/seththeeke/nyc-311/issues/202#issuecomment-6776019537) with three questions and the answers I'd pick:
  1. Dial-up: none of its own; it's measured during the first caller's (#170 or #194) `C` → `T1` step.
  2. Baseline: success rate has no baseline. The 20 ms latency target is baselined against the FeatureFlags API Lambda's existing `getTreatment` read, measured with CloudWatch Logs Insights.
  3. Query of record: CloudWatch, not the warehouse.

## Baseline
None. It isn't measurable until the questions are answered. No `run_query` calls used.

## What's next
Celestine (the metric) and Rex (the dial-up) answer on the ticket. Their reply resumes the card. Then I measure the baseline, write `docs/kid-kestral/202-backend-read-feature-flags-in-services.md`, commit it, and move the card to Spec Created.
