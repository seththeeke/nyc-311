# gen-purpose-dev · #194 Dispatch the nearest idle operator

**Card:** #194, moved Assigned → **Spec Created** on 2026-11-13. It is held 12 hours before development.

## What I did
- Checked the bar. The ticket body has the verification block (metric, query, target, window, guardrails, Flag, Dial-up), and the issue carries both `cpo-approved` and `cto-approved`. The open questions were resolved on 11-09 (greedy nearest pick; fallback-location orders keep first-available).
- Read `orderSchedulingService.ts`, `operatorDao.ts` (`findIdleOperator`, `Limit: 1`), `transitTimeService.ts`, `pathPlanningService.ts`, `featureFlagService.getTreatment` and `Nyc311OrderSchedulingLambda.ts`.
- Took the baselines with three warehouse queries.
- Wrote and committed the spec: `docs/kid-kestral/194-dispatch-the-nearest-idle-operator-to-each-order-not-whichever-the-index-returns-first.md`, commit `6d19f8e`.
- Commented on the ticket and posted to #tech-team.

## Verification plan and "before"
- **Decides (V1):** the average operator-to-job drive distance in the warehouse. Before (Nov 10-12, 396 jobs, 52 ticks): **8.16 mi** actual. A random pair in the same tick is 8.69 mi; the nearest operator is 3.22 mi. Target ≤ 5.5 mi over 7 days at 100% T1.
- **V2:** a new `distanceMiles` field (plus alternatives) on `OrderScheduleEstimated`, checked with Logs Insights in Test and Prod. It doesn't exist today.
- **V3:** transit hours per job, ≈ 0.53 h before.
- **V4:** driving share of paid hours. Reported but not deciding: it fell from 22% to 11.0% (Nov 12) because demand dropped, with no code change.
- **Guardrails:** median time to resolve 173.72 h; 69.1% resolved after the SLA (1,090 orders resolved Nov 6-12). Two new logs cover skips while operators sit idle and claim-cap exhaustion.

## Flag and legs
- **Flag:** `NEAREST_OPERATOR_DISPATCH` (absent today). `C` = first-available, `T1` = nearest. Read once per run, falling back to `C`.
- **Leg 1:** flag read, FeatureFlags grant and distance logging at C. Depends on #202.
- **Leg 2:** under T1, list idle operators once per run and claim the nearest, with up to 3 tries on a claim conflict.

## Next / needs a human
- Create the flag rows: Test `T1`, Prod `C`.
- #202 must ship first. It is in Intake.
- The `nyc311-gen-purpose-dev` AWS profile is still missing on the host, so the CloudWatch checks can't run.
