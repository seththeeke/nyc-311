# v1 Prod Deployment — Build/Defer Decisions + Launch Checklist

> **Status: decisions complete (2026-09-28). The build phase hasn't started.**
> Every placeholder and brute-force decision found in the codebase has been
> classified as **must-have for v1**, **intentional as-is**, or **deferred**
> (each deferral has a ticket or a named v2 home). Nothing in Prod should be
> half-built by accident. If you find something that isn't in this doc, it's
> a gap: add it here before launch.

**How to read this doc:**
- **Part F** is the pre-launch build plan: what gets implemented, in order.
- **Part D** is the manual launch runbook.
- **Part E** is post-launch verification.
- **Part G** is the register of everything deliberately deferred.
- **Parts A–C** are the original findings, each with its decision.
- The **decision log** records the reasoning.

**Guiding priorities (Q1):** a realistic, real-time simulation of NYC Street
Condition work, with **cost** and **speed of resolution** as the competing
priorities. **Full CD, no manual approval gates (Q9).**

"Dial-up" means turning on real ingestion in `Nyc311-Prod` with a manually
created fleet, so the full Request → Order → Schedule → Execute → Resolve
loop runs against live NYC 311 data in real time.

---

## 0. Current state snapshot (read-only checks, 2026-09-28)

| Area | State |
|---|---|
| Prod stack | At research start, Prod was 3 commits behind (`b026726`): runs for `af1410d`→`c998655` failed at `DeployTest`. **Update (later on 2026-09-28): the `f96a839` run succeeded end to end, so Prod matches main.** |
| Pipeline gate | `DeployProd` promotes **automatically** once Test's blocking integration tests pass. There is no manual approval step. |
| Prod data | `Requests-Prod` holds 1 item (the cursor). `Orders`/`Operators`/`Locations-Prod` are empty. `Users-Prod` has 2 items. `WarehouseJobRuns-Prod` has 23. |
| Prod schedules | `Nyc311PollerSchedule-Prod` is **DISABLED** (set outside CDK, so this is drift). `Nyc311OrderSchedulingSchedule-Prod` is ENABLED and runs hourly against an empty fleet. There is no `wbr` schedule in Prod (#44). |
| Alarms → email | **Only `Nyc311PollerFailures-{Test,Prod}` has a confirmed subscriber.** `Nyc311OrderPipelineFailures-*`, `Nyc311OrderSchedulingFailures-*`, `Nyc311WarehouseJobsFailures-*`, and `Nyc311PipelineFailures` have **zero subscriptions**. My guess is the confirmation emails were never clicked, so AWS deleted the pending subscriptions. Those alarms currently notify nobody. |
| Cost guardrails | No AWS Budget exists. Last 30 days cost ~$7 (CodeBuild $5.56, CodePipeline $0.85, DynamoDB $0.62). |
| API throttling | `Nyc311Api-Prod` `$default` stage has no rate or burst limit. |
| Lambda concurrency | The account quota is now **400**. The memory note saying "10" is stale. |
| Test execution health | `Nyc311OrderExecution-Test`: 100 SUCCEEDED, 0 FAILED/TIMED_OUT. All 20 active Test operators are IDLE. |

---

## Part A — Placeholder / brute-force logic: build now vs. defer

Every non-intentional stand-in found in `backend/` (plus the web-app and CDK
equivalents). "Brute force" means the logic works but is a fixed constant or
a simple heuristic standing in for a real model.

| # | Item | Where | What it does today | Prod impact if left as-is | Decision |
|---|---|---|---|---|---|
| A1 | **No compensation when an order execution fails** | `cdk/step-function/Nyc311OrderExecutionStateMachine.ts` (Catch → `Fail`), `service/scheduling/orderSchedulingService.ts#dispatchOneOrder` | If any Dispatch/Arrive/Resolve task fails, the execution ends in `Fail`. The Operator stays in `TRANSIT`/`WORKING` and the Order stays in `EXECUTE` forever. The same thing happens if `startTransit` succeeds but `scheduleOrder` or `StartExecution` then throws. There's no sweeper or reconciliation. | Each failure permanently takes one vehicle out of the fleet, and nothing alarms on it. With 10 vehicles, the Prod fleet decays silently. | **DECIDED Q3 (direction only): fix before launch.** The detailed design is revisited at implementation time (see decision log). |
| A2 | **Case persistence is log-only** | `service/case/caseService.ts` (`CaseCreationStub`) | `createCase` only writes a log line. Callers: `resolveLocation` when there's no BBL (the Request stays `DRAFT` forever), and `evaluateOrder`'s `CASE` branch (unreachable today, since `StreetConditionOnlyRule` only returns ACCEPT/REJECT). | Requests without a BBL pile up as `DRAFT` with no record except logs. Blocks #8. | **DECIDED Q4: deferred to v2.** Support/Cases is among the first v2 items. After Q2 there are no live callers. |
| A3 | Priority tier + SLA are fixed | `service/order/orderPriorityService.ts` (`MockOrderPriorityAssigner`) | Every Order gets `STANDARD` with an SLA of accept time + 24h. | The scheduler sorts by `sla_deadline`, so dispatch is effectively FIFO. SLA-breach metrics mean "older than 24h". | **Q5: considered alongside the descriptor model.** It may stay a v1 constant. Decided in the Q5 session. **Decided 2026-10-03: stays the v1 constant.** |
| A4 | Processing time is a fixed 30 min | `service/scheduling/processingTimeService.ts` | 30 min at scheduling, then × a random factor in [1, 2) at execution. | Every Street Condition job takes 30–60 real minutes in Prod. | **DECIDED Q5: must be implemented before launch.** Descriptor-driven. The design is deferred to a dedicated working session (see decision log). ✅ Built 2026-10-03 (F5). |
| A5 | Transit time is straight-line at 25 mph | `transitTimeService.ts`, `pathPlanningService.ts` | Flat-earth distance, 25 mph, 10 min minimum, long-haul penalty, then × a random factor in [1, 2) at execution. Route planning is deferred (doc 11 Topic 3). | Plausible for a sim. Nothing breaks. | **DECIDED Q5: keep for v1.** Routing stays deferred (doc 11 Topic 3). |
| A6 | Single fixed depot | `models/gpsLocation.ts` `HOME_DEPOT_LOCATION` (City Hall) | Every Operator starts here. It's also the fallback job location when a Location has null lat/lng. | Jobs with no coordinates get "serviced" at City Hall, which skews the fleet map and transit times. | **DECIDED Q5: keep for v1.** Verified that 100% of Street Condition records with a BBL have lat/lng (2,558/2,558 since 09-01), so the fallback never fires under BBL-only. |
| A7 | Default operator rate $45/hr | `service/capacity/capacityService.ts` | Placeholder business input. | Feeds burn rate and any cost tiles. | **DECIDED Q5: keep as the v1 labor-cost input.** Material cost comes from the descriptor model. |
| A8 | **Prod simulation runs in real time** | `stack/Nyc311Stack.ts` `simulationTimeScale` (Test 100, Prod 1) | Prod waits real minutes and hours per job. | Throughput is capped by fleet size times real job duration. | **DECIDED Q1: keep real time (scale 1).** Size the fleet to real volume. |
| A9 | Every Request becomes an Order, then non–Street Condition ones are rejected | `requestEvaluationService.ts` FILTERS vs. `orderEvaluationService.ts` `StreetConditionOnlyRule` | The only Request-level filters are BBL present and not already closed. The complaint-type narrowing happens at Order evaluation, so every 311 complaint creates an Order plus events, then gets REJECTED. | Test has 1.7M Order items for 509k Requests. Every rejected Order still costs writes, stream, SNS, SQS, Firehose, and warehouse rows. It works, but it's the most "brute force" part of the pipeline. | **DECIDED Q6: keep as-is (intentional).** |
| A10 | Operator claim isn't atomic | `dao/operator/operatorDao.ts` `findIdleOperator` + `startTransit` (deferred per doc 10 §1.5) | `startTransit` doesn't check that the Operator is `IDLE`. The only protection is the sequence-number condition. The hourly schedule and the admin `POST /scheduling/run` can overlap. | A rare double-assignment of one vehicle. | **Folded into Q3** for the implementation-time design pass. Recommendation on file: an `IDLE` condition on `startTransit`. ✅ Built 2026-10-03 (F6). |
| A11 | Failure injection doesn't exist | CLAUDE.md §5.2 convention, #36 | No chaos-config code anywhere in `backend/`. | None at runtime. It's a portfolio or feature gap only. | **DECIDED Q7: defer to v2.** Add a note to CLAUDE.md §5.2 that the convention isn't implemented yet. |
| A12 | Cost prediction and the ML cost model are held | doc 11 §5/§6 | The Total Cost tile shows "no data yet" until `wbr` gains `total_cost`. | A visible empty tile in Prod. | **DECIDED Q7: must-have for launch.** `total_cost` (labor + material, from Q5) is added to the `wbr` query, applied by hand in Test and Prod. Prediction and ML (doc 11 §6) are deferred to v2. |
| A13 | Location resolution uses BBL only, with no geocoding fallback | `requestEvaluationService.ts#resolveLocation` | A missing `bbl` halts the Request (see A2). | **Measured: 64% of Street Condition complaints have no `bbl`** (4,475 / 7,033 since 2026-09-01). Of those, 2,571 have lat/lng and 1,904 have neither. Under BBL-only resolution, about two-thirds of the target workload halts. | **DECIDED Q2: BBL-only for v1.** A miss becomes an Order that gets REJECTED with `reason_code: LOCATION_UNRESOLVED` (see decision log). Geocoding and lat/lng fallback are deferred. |
| A14 | About page has two "Work in progress" sections | `web-app/src/components/about/aboutSections.ts` (Machine Learning, LLMs) | These render "details coming soon". | Visible in Prod. They're intentional, but should be a conscious choice. | **DECIDED Q7: leave as "Work in progress" on purpose.** AI/ML is planned for v2. |
| A15 | Mock admin credential ships in the Prod bundle | `web-app/src/services/authService.ts` imports `test-data/adminUser.ts` unconditionally | The mock-mode login credential is in the live JS bundle. It's only used in mock mode. | Harmless **only if** it doesn't match the real Cognito admin password. User to confirm. | **DECIDED Q11: must fix. No credentials of any kind in the public bundle.** The approach is chosen at build time. |

## Part B — Production readiness (non-feature)

| # | Finding | Risk | Decision |
|---|---|---|---|
| B1 | 4 of 5 alarm SNS topics have no subscribers, including the pipeline-failure topic | Every alarm except the poller alarm is silent | **DECIDED Q8: manual re-subscribe + confirm** (Part D step 2). |
| B2 | No AWS Budget or billing alarm | A runaway cost bug (a retry loop, a public-endpoint scrape) goes unnoticed until the bill arrives | **DECIDED Q8: build in CDK, $20/month.** |
| B3 | No throttling on the Prod HTTP API. Public routes include `/fleet/locations` (1769 MB Lambda) and `/lambda-metrics` (48 CloudWatch calls per hit) | Denial-of-wallet, and public traffic competing with pipeline Lambdas for concurrency | **DECIDED Q9: build crude, free throttling.** |
| B4 | `DeployProd` has no manual approval | Any green main commit reaches live Prod. Fine pre-launch, but less so once real data flows. | **DECIDED Q9: no manual approval. Full CD is a core principle.** |
| B5 | The Prod poller is disabled by console, not CDK | Drift: a later CDK change to the schedule can silently re-enable it (or the reverse), and the dial-up isn't in code | **DECIDED Q9: a `pollerEnabled` flag per environment in CDK.** |
| B6 | No alarm on order-execution state machine failures (`ExecutionsFailed`), and no warehouse alarms (#25) | Directly compounds A1 | **DECIDED Q8: defer.** Alarms and custom metrics cost real money. Includes the Q3 `ExecutionsFailed` alarm; Q3 measures failures through `wbr` instead. |
| B7 | `web-app` `test:coverage` fails on Node 22+ (#54). `happy-dom` has a critical advisory (#48, dev-only) | The Operational Loop can't pass locally for web-app | **DECIDED Q10: both must be fixed before launch.** |
| B8 | Warehouse correctness: #40 (dedup on the wrong column), #37 (`event_name` doc/schema mismatch) | #40 can make "current state" queries pick stale rows. `wbr` doesn't depend on it (see B12). | **DECIDED Q10: both are must-haves**, pending a deeper look at #40. |
| B9 | DynamoDB tables have PITR + `RETAIN`, but deletion protection is off | Low. An accidental table delete is recoverable from PITR, just more painful. | **DECIDED Q11: enable deletion protection on all Prod tables.** |
| B10 | Admin Cognito MFA is off (deliberate per doc 9 §2) | Single-admin account. The admin can run Athena and change the fleet. | **DECIDED Q11: defer MFA.** |
| B12 | **`wbr.orders_created` overcounts.** Test's `wbr.sql` does `COUNT(*) FROM order_snapshots`, and `order_snapshots` gets one row per projection change (create + every MODIFY), not one per order. It doesn't use #40's dedup; the separate `operator_latest` CTE correctly orders by `last_event_sequence`. | The "orders created" metric is inflated by roughly the average number of transitions per Order | Fix in the Q7 `wbr` rewrite: count `ORDER_CREATED` in `order_events` instead. |
| B11 | Stale comments say "Leg 3, not yet built" (`capacityService.ts#removeCapacity`, `operatorDao.ts` ~L84), but Leg 3 shipped | Misleading only | **DECIDED Q12: fix inside F4.** ✅ Done 2026-10-01. |

## Part C — Backlog and GitHub issue triage

| Issue | Title (short) | Proposed disposition | Decision |
|---|---|---|---|
| #5 | Draft-Request backlog never reaches the pipeline | Moot for Prod, which starts empty. Test-only now. | **Defer (Q12).** |
| #8 | No automatic Case on evaluation DLQ | Tied to A2 | **Defer to v2 (Q4).** The DLQ-depth alarm covers v1 once B1 is fixed. |
| #9 | Pipeline build-time optimization | Defer (dev-ex) | **Defer (Q12).** |
| #11 | Scheduler re-Cases unroutable Orders hourly | **Looks obsolete.** Capacity pools were removed (doc 10 §3.5) and the scheduler no longer calls `createCase`. Verify, then close. | **Close as obsolete (Q4).** |
| #24 | biz-intel-agent BI layer | Defer | **Defer (Q12).** |
| #25 | Warehouse alarm suite | See B6 | **Defer (Q8)**, cost-conscious. |
| #34 | CDK Vitest 60s RPC timeout on CodeBuild | Defer, but it's a pipeline-reliability risk | **Defer (Q10).** |
| #36 | Failure injection at EXECUTE | See A11 | **Defer to v2 (Q7).** |
| #37 | `event_name` never reaches Glue | See B8 | **Must-have (Q10).** |
| #40 | `order_snapshots` dedup column | See B8 | **Must-have (Q10)**, with a deeper look first. |
| #44 | Create `wbr` job in Prod | **Launch checklist item** | **Part D step 9**, with the final v1 SQL (F8). |
| #48 | happy-dom critical advisory | See B7 | **Must-have (Q10)**, together with #54. |
| #51 | Fleet snapshot precompute | Defer. Revisit triggers are already defined in the ticket. | **Defer (Q12).** |
| #54 | web-app coverage broken on Node 22+ | See B7 | **Must-have (Q10)**, and first in build order. |

---

## Part F — Pre-launch build plan (must-haves, in order)

Each item goes through CLAUDE.md §2's Operational Loop in every affected
package and ships through full CD. Items marked **design session** get a
detailed design conversation before any code.

| # | Item | Packages | Source |
|---|---|---|---|
| F1 | **✅ Done 2026-09-30** (#54 via PR #55; #48 via `c7718cc`). Fix web-app `test:coverage` on Node 22+ (#54) and bump `happy-dom` to ≥20.x (#48). This unblocks every later web-app change. | web-app | Q10 |
| F2 | **✅ Done 2026-09-30** (live builds tree-shake mocks + `test-data/`; `vite.config.ts` `liveBundleGuard` fails any live build that leaks them, so the pipeline's existing live build is the gate, with no cdk change). Remove credentials from the public bundle, plus a build check that fails if a credential or test-data reaches `web-app/dist` (A15). | web-app, cdk (pipeline check) | Q11 |
| F3 | **✅ Done 2026-09-30** (deletion protection on all 7 tables when `envName === "PROD"`; `POLLER_ENABLED` in `cdk/stack/Nyc311Stack.ts`, Prod `false`; `Nyc311CostBudget` (`Nyc311MonthlyCost`), Prod stack only; `$default` stage 10 rps / burst 20, `GET /fleet/locations` 2/5, `GET /lambda-metrics` 1/2). Prod-only safety: DynamoDB deletion protection on all Prod tables (B9), the `pollerEnabled` flag per environment with Prod `false` (B5), the $20/month AWS Budget construct, Prod-only (B2), and API stage + expensive-route throttling (B3). | cdk | Q8, Q9, Q11 |
| F4 | **✅ Done 2026-10-01** (codes renamed to generic `SERVICE_NOT_SUPPORTED` / `LOCATION_UNRESOLVED`; see Q2's 2026-10-01 note). Order rejection reason codes. A BBL miss becomes an Order rejected with `LOCATION_UNRESOLVED`, and non–Street Condition Orders get `SERVICE_NOT_SUPPORTED`. `Order.location_id` becomes nullable. Includes the stale-comment cleanup (B11). | backend, web-app, docs | Q2, Q4 |
| F5 | **✅ Done 2026-10-03** (design: Q5's 2026-10-03 session). **Design session:** the descriptor-driven job model: processing time, material cost, and descriptor-based evaluation outcomes (e.g. `Blocked - Construction` isn't dispatched). Build it after the session. | backend (+ cdk/web-app as designed) | Q5 |
| F6 | **✅ Done 2026-10-03** (design: Q3's 2026-10-03 session). **Design session:** execution-failure handling. The truck goes back to IDLE, the Order is marked FAILED, the scheduler retries it normally, and this includes the non-atomic claim fix (A10). | backend, cdk | Q3 |
| F7 | **✅ Done 2026-10-03.** #40: the stored data was always correct; only the dedup *queries* were wrong. No live job was affected (Prod has no jobs; Test's only job, `wbr`, already dedups operators by `last_event_sequence`). Fixed the seed jobs in `test-scripts/9-backfill-warehouse-jobs.py` and doc 7's guidance: `order_snapshots`/`operator_snapshots` dedup by `last_event_sequence DESC, warehouse_ingested_at DESC`, and F8's `wbr` must follow it. No shared view, since there's only one live call site. #37: both fan-outs now embed `event_name` in the SNS body (raw delivery dropped the attribute), with a real `event_name` column on `order_snapshots` and `requests`, null on REBUILD rows. Warehouse correctness: investigate, then fix #40 (`order_snapshots` dedup key), and make `event_name` real in the warehouse (#37). | backend, cdk, docs | Q10 |
| F8 | Final v1 `wbr` SQL, applied by hand (it's a job definition, not code). It covers the Street Condition funnel + rejection rate by `reason_code` (F4), execution-failure count/rate (F6), `total_cost` = labor + material (F5), and the existing weekly metrics, with the `orders_created` overcount fixed (B12). Check the SQL into the repo, e.g. `docs/v1-wbr.sql`. | — (manual, Test first) | Q2, Q3, Q7 |
| F9 | Housekeeping: close #11 as obsolete, tag #8/#36 as v2, add a CLAUDE.md §5.2 note that failure injection isn't implemented yet, update the stale Lambda-concurrency memory (the quota is now 400), and file a ticket for the lat/lng-or-geocoding location fallback. | docs, GitHub | Q2, Q4, Q7 |

## Part D — Launch runbook (manual steps, in order)

Every AWS-mutating step gets **explicit confirmation immediately before it
runs** (CLAUDE.md §3), and every CLI call uses `--profile nyc311`.

**Before dial-up**
1. [ ] All of Part F has shipped. The pipeline is green end to end on the launch commit, and `Nyc311-Prod` matches main.
2. [ ] **Alarm subscriptions (B1/Q8):** subscribe **seththeeke@gmail.com** (email) to every alarm topic that has no subscriber, then click each confirmation email **within 3 days**, or AWS deletes it again. The topics:
   - `Nyc311OrderPipelineFailures-Prod`, `Nyc311OrderSchedulingFailures-Prod`, `Nyc311WarehouseJobsFailures-Prod`
   - `Nyc311PipelineFailures`
   - optionally the `-Test` equivalents

   Verify with `aws sns list-subscriptions-by-topic`: each should show an ARN, not `PendingConfirmation`.
3. [ ] **Budget (Q8):** confirm the CDK-built $20/month budget exists in the Budgets console, and that its alerts reach seththeeke@gmail.com.
4. [ ] **Admin access (Q11):** log in at `boroughsim.com` as the Prod admin (`Nyc311AdminPool-Prod`). Confirm the real password isn't the old mock one, and rotate it if it is.
5. [ ] **Deletion protection (Q11):** `aws dynamodb describe-table` shows `DeletionProtectionEnabled: true` for all 7 Prod tables.
6. [ ] **Throttling (Q9):** a quick burst against `GET /fleet/locations` in Prod returns `429`s past the limit, while normal dashboard use is unaffected.
7. [ ] **`wbr` in Test (F8):** apply the final v1 SQL to `wbr` in Test, run it, and verify every column is populated with plausible values.
8. [ ] **Rejection-rate report gate (Q2):** review Test's `wbr` numbers: Street Condition created, accepted, and rejected by `reason_code` (at least `LOCATION_UNRESOLVED`), plus the rejection rate. This is the baseline we'll use to decide when BBL-only resolution needs improving.
9. [ ] **`wbr` in Prod (#44):** create the `wbr` job in Prod with the identical SQL (from the checked-in file) and the same cadence as Test.
10. [ ] **Fleet (Q12), by hand only, never scripted:** create the initial Prod fleet (likely 5–10 vehicles; the exact number and names are your call) through the admin Capacity page at `boroughsim.com`. Confirm the Capacity widget and fleet map show them all IDLE at the depot.

**Dial-up**

11. [ ] **Forward-only cursor (Q12).** Prod's cursor is stale at `last_watermark: 2026-08-13T01:24:08`, checked via the public `GET /ingestion/metrics`. Leaving it would backfill ~47 days. Deleting it would still backfill 24h (`INITIAL_WINDOW_HOURS`). **Immediately before step 12**, overwrite the `CURSOR#NYC_311` item in `Requests-Prod` with `last_watermark` = the current UTC time (SoQL format, no ms/Z) and `resume_offset: null`. Take the exact key/attribute shape from `models/ingestionCursor.ts` and `requestDao.putCursor`. Then confirm `GET /ingestion/metrics` shows `lag_hours` ≈ 0.
12. [ ] **Flip `POLLER_ENABLED.PROD` to `true`** in `cdk/stack/Nyc311Stack.ts` (F3) in a commit, merge, and let full CD deploy it. Confirm `Nyc311PollerSchedule-Prod` shows `ENABLED`.

## Part E — Post-dial-up verification

**First 6–12 hours**
- [ ] First poll (within 6h): the `PollCompleted` log has `records_ingested > 0`, and the Ingestion Monitoring page shows the cursor advancing with `is_stale: false`.
- [ ] Requests → Orders: Street Condition Orders with a BBL reach `SCHEDULE`. Everything else is `REJECTED` with the correct `reason_code`.
- [ ] Within the next hour, a scheduling run dispatches Orders to IDLE vehicles, and `Nyc311OrderExecution-Prod` shows RUNNING executions.
- [ ] The first executions reach `SUCCEEDED` in real time (roughly transit + processing from F5), and the vehicles return to IDLE.

**First `wbr` run**
- [ ] Warehouse freshness, checked by hand since there's no alarm per Q8: new objects under the warehouse bucket's `order_events` prefix are less than 1h old.
- [ ] The `wbr` run succeeds. `GET /workspace/metrics` in Prod returns non-null values, and the Serviced, MTTR, and Total Cost tiles are all live.

**Check-ins at 24h, 7 days, and 30 days**
- [ ] Fleet utilization and SCHEDULE backlog. Is the fleet size keeping up with the ~300/day Street Condition volume (Q1)? Adjust by hand if not.
- [ ] Execution-failure rate from `wbr` (Q3/F6). This decides whether retry caps or a sweeper are needed.
- [ ] `LOCATION_UNRESOLVED` rejection rate (Q2). This decides when to build the location fallback.
- [ ] DLQ depths: `Nyc311OrderEvaluationDlq-Prod`, `Nyc311PollerDlq-Prod`, `Nyc311OrderSchedulingDlq-Prod`.
- [ ] Cost to date against the $20 budget, via Cost Explorer grouped by service.
- [ ] Warehouse freshness, again by hand (Q8).

## Part G — Deferred register (intentional, with a home)

| Item | Deferred to | Tracking |
|---|---|---|
| Case persistence / support (A2) | **v2, first priority** | #8 (tag v2) |
| Chaos config / failure injection (A11) | v2 | #36 |
| Cost prediction + ML cost model (A12, doc 11 §6) | v2 | doc 11 |
| About page "Machine Learning" / "LLMs" (A14), left as "Work in progress" on purpose | v2 (AI) | — |
| Location fallback: lat/lng or geocoding for the ~64% of Street Condition complaints with no BBL (A13) | Decide from the `LOCATION_UNRESOLVED` rejection rate | new ticket (F9) |
| Route planning / traffic-aware transit (A5) | Undecided (doc 11 Topic 3) | doc 11 |
| Real depot(s) (A6) | Later. The fallback never fires under BBL-only. | — |
| Priority/SLA model (A3) | Stays a v1 constant (F5 session, 2026-10-03). Revisit with launch data. | doc 11 / F5 |
| Retry cap, reconciliation sweeper, `ExecutionsFailed` alarm | Decide from the `wbr` failure rate after F6 | F6 notes |
| Warehouse alarm suite + Firehose freshness alarm (B6) | Cost-conscious deferral. Freshness is checked by hand. | #25 |
| Admin MFA (B10) | Later | — |
| Draft-Request backlog (#5) | Test-only; moot for Prod | #5 |
| Pipeline build speed (#9), CDK Vitest RPC flake (#34) | Later. #34 gets fixed promptly if it blocks CD. | #9, #34 |
| biz-intel-agent (#24) | Later | #24 |
| Fleet snapshot precompute (#51) | When p90 > 2s or the fleet grows a lot | #51 |
| Complaint-type filter at the Request stage (A9) | **Not deferred: intentionally kept as-is** (Q6) | — |

---

## Decision log

*(Filled in as each question is resolved.)*

### Q1 — What is Prod? (2026-09-28)
**Decision: a realistic, real-time twin of NYC.** `SIMULATION_TIME_SCALE`
stays at 1 in Prod. The fleet is sized to real Street Condition volume.
**Cost and speed of resolution are the two competing priorities** that every
later trade-off gets judged against.

Volume measured from the public SODA API (Street Condition, 2026-08-01 →
2026-09-28, 58 days): median **317/day**, mean 286, max 492. The minimum
of 5 is the partial current day.

Rough fleet sizing: an average job is about 20 min of transit plus 45 min of
processing (30 min × a 1.5 mean variance factor), so roughly 20 jobs per
vehicle per day at 24/7. The actual size depends on Q2:
- BBL-only (~36% pass): ~110 Orders/day → ~6 vehicles at 100%, **~8–10** with headroom.
- BBL or lat/lng fallback (~73% pass): ~220 Orders/day → ~11 at 100%, **~15–16** with headroom.
- Both assume 24/7 operation with no shifts. Peak days (~490) will build a backlog that drains overnight.

### Q2 — Location resolution for Street Condition (2026-09-28)
**Decision: BBL-only for v1, but a missing BBL becomes a measured Order
rejection instead of a silent halt.** There's no change to `Request`.

**Pre-launch build item (B-Q2):**
- `resolveLocation`: when there's no `bbl`, CONTINUE with no `location_id` instead of HALT, and create no Case.
- `evaluateRequest`: create the Order even when there's no resolved location.
- `Order.location_id` becomes nullable (`models/order.ts`, `data-model.md`, web-app model). This is the only model change.
- `OrderEvaluationRule` returns `{ outcome, reasonCode }`. Codes are ALL_CAPS: `SERVICE_NOT_SUPPORTED` is checked first, then `LOCATION_UNRESOLVED`. `rejectOrder` stamps `reason_code` into the `ORDER_REJECTED` event payload.
- **Renamed at build time (2026-10-01):** originally `NOT_STREET_CONDITION` and `MISSING_BBL`. You asked for generic codes, so they aren't tied to one complaint type or to BBL as the only way to resolve a location (the lat/lng fallback would have made `MISSING_BBL` wrong).
- The scheduler narrows `location_id` to non-null. Accepted Orders always have one.
- `wbr` adds a Street Condition funnel, read from `order_events` (append-only, so it sidesteps #40): created, accepted, rejected by `reason_code`, and rejection rate.
- Side effect we accept: non–Street Condition complaints without a BBL now also create Orders and get rejected, which adds a little to A9's volume.

**Deferred with a ticket:** a lat/lng fallback or geocoding for the ~64% of
Street Condition complaints with no BBL. We'll decide when to build it from
the rejection-rate report.

### Q3 — Order execution failure handling (2026-09-28)
**Decision: fix before launch, direction agreed, details revisited at
implementation time.** Your model:
- **When an execution fails, the truck simply stops and is marked IDLE.** It rejoins the available fleet, with no special recovery flow.
- **The Order is marked `FAILED`** (or an equivalent status/stage, to be named during design). The scheduler then picks it back up for a retry **through its normal path**, with no special-case retry logic.
- **Failures are measured in `wbr`**: execution-failure count and rate, and retried Orders. This tells us how much the problem matters before we invest in anything special, such as retry caps, backoff, a reconciliation sweeper, or a Case.

**Open for the implementation-time revisit (don't decide these now):**
- The name and semantics of `FAILED`. Is it a status, or a stage reset to `SCHEDULE` with a failure event? How does the scheduler's `gsi1-stage-sla` query see it?
- Whether failed Orders keep their original `sla_deadline` (and so get retried first).
- The pre-execution leak path in `dispatchOneOrder` (the Operator is claimed, then `scheduleOrder` or `StartExecution` throws), which should follow the same "truck back to IDLE, Order failed" rule.
- Step Functions task Retry for transient Lambda errors, applied before the failure path.
- A10 (the non-atomic Operator claim) as part of the same change.
- A `ExecutionsFailed` CloudWatch alarm (ties to B1/B6).
- Deferred unless `wbr` shows a need: a retry cap / `EXECUTION_FAILED` reason code, and a reconciliation sweeper.

**Design session outcome (2026-10-03), built as F6:**
- **`FAILED` shape:** a stage reset, not a new status. `orderDao.recordExecutionFailed` appends `STAGE_FAILED` (stage `EXECUTE`, payload `{ operator_id, reason }`) and moves `current_stage` back to `SCHEDULE`, incrementing `retry_counts.EXECUTE` and clearing `assigned_operator_id`, `scheduled_*` and the materials estimate. The scheduler's existing `STAGE#SCHEDULE` query finds it unchanged.
- **SLA on retry:** the original `sla_deadline` is kept, so a retried Order sorts ahead of newer work.
- **Where cleanup runs:** each execution step's `Catch` routes to a new `HandleFailure` step (`phase: "FAIL"` on the same execution Lambda), which then ends the execution `Failed` so it stays visible. If cleanup itself fails, the execution ends `Failed` directly. `LambdaInvoke`'s default `retryOnServiceExceptions` already retries transient Lambda errors before `Catch` fires, so no extra Retry was added.
- **One cleanup function:** `orderExecutionService.failExecution`. It resets the Order only while it's still `EXECUTE` on this vehicle, and frees the vehicle (new `WORK_ABORTED` operator event, back to `IDLE` at its last GPS ping) only while it's busy with no *other* Order executing on it. Repeat calls are safe, and a re-claimed vehicle is never freed. It finalizes a queued removal, like Resolve does.
- **Pre-execution leak:** after `dispatchOneOrder` claims a vehicle, a failure in `scheduleOrder` or `StartExecution` runs the same `failExecution` in-process, then rethrows so the run counts the Order as failed.
- **A10 (atomic claim):** `operatorDao.startTransit` re-checks `ACTIVE` / `IDLE` / no queued removal on a fresh read, and the append is conditioned on that read's sequence. Otherwise it throws the new `ConflictError`. The scheduler treats a conflict as a skip (`ordersSkippedNoCapacity`), not a failure, leaving the Order in `SCHEDULE` for the next run.
- **Still deferred** (decide from `wbr`'s `STAGE_FAILED` rate, F8): retry cap, reconciliation sweeper, `ExecutionsFailed` alarm.

### Q4 — Cases (2026-09-28)
**Decision: defer Case persistence to v2.** Support/Cases will be among the
first things built in the v2 model. After Q2, `createCase` has no live
callers, so this is a clean, deliberate deferral rather than a hidden gap.
- The `caseService.ts` stub stays as the documented seam. The Q2 build item updates its now-stale caller comments (and the ones in `requestEvaluationService.ts`).
- #8 stays open, tagged v2. For v1 the evaluation-DLQ depth alarm is the safety net, which depends on B1.
- #11: close as obsolete.

### Q5 — Descriptor-driven job model (2026-09-28)
**Decision: the `ProcessingTimeEstimator` must be implemented for real
before launch, driven by the 311 `descriptor`.** You want to shape this in
detail, so the design happens in a dedicated working session when we build
this section. Don't pre-decide numbers or structure.

What the descriptor should influence (your stated scope):
1. **Processing time.** Replace the fixed 30 min (× [1, 2) variance).
2. **Cost of materials.** A new per-job cost component on top of labor (vehicle `rate_per_hour` × time). This feeds the cost priority and, eventually, the Total Cost tile (A12).
3. **Evaluation outcome.** Some descriptors shouldn't dispatch a truck at all. Example: **`Blocked - Construction`** is likely resolved another way. This means descriptor-aware rules in `OrderEvaluationRule` with their own `reason_code`s (extending Q2's model), or a non-dispatch resolution path. That's to be designed.

Reference data (Street Condition descriptors, 2026-09-01 → 09-28): Pothole
3,173 · Cave-in 1,638 · Defective Hardware 529 · Blocked - Construction 446 ·
Rough, Pitted or Cracked Roads 386 · Failed Street Repair 336 · Plate
Condition - Noisy 186 · Line/Marking - After Repaving 87.

Questions for that session:
- Where the descriptor table lives: a code constant, a DynamoDB config item, or feature-flag treatments (the Topic 4 infrastructure already exists).
- The variance model per descriptor: keep the uniform [1, 2), or use a per-descriptor spread.
- Whether A3 (priority/SLA) becomes descriptor-driven at the same time (e.g. cave-in above pothole).
- How material cost is recorded (Order event payload? `scheduled_*` fields?) so `wbr` can report cost per job, per descriptor.
- The default for unknown or new descriptors.
- Re-sizing the fleet (Q1) once real durations exist. The Q1 estimate assumed a 45-min average.

A5 (travel time), A6 (depot) and A7 ($45/hr labor rate) stay as-is for v1.

**Design session outcome (2026-10-03), built as F5:**
- **Processing time:** `StreetConditionProcessingTimeEstimator` (`service/scheduling/streetConditionProcessingTimeService.ts`) implements the existing `ProcessingTimeEstimator` interface with a plain `switch` on `descriptor`, returning a constant expected time per job. It replaces the fixed 30-min mock in both scheduling and execution.
- **Materials cost:** the same pattern. A new `MaterialsCostEstimator` interface plus `StreetConditionMaterialsCostEstimator`, a switch returning a constant USD estimate. No `COST_MODEL` flag wiring until a second (ML, v2) implementation exists; estimates are labeled `cost_model: "BRUTE_FORCE"`.
- **Recording (estimate + actual):** the estimate goes on `ORDER_SCHEDULED` (`materials_cost_estimate`, `cost_model`), per doc 11 §5a. The actual is drawn at Dispatch as the live estimate × the *same* processing variance factor (longer jobs use more material), carried by the state machine as `$.dispatch.materials_cost_actual`, and stamped on `ORDER_RESOLVED` (`materials_cost_actual`). The projection gains nullable `estimated_materials_cost` / `actual_materials_cost` / `cost_model_used`, and `order_snapshots` gains matching columns. `wbr` should use the actual.
- **Variance:** unchanged, a uniform [1, 2) factor at execution for every descriptor.
- **No-dispatch descriptors become inspection jobs, not rejections:** `Blocked - Construction`, `Dumpster - Construction Waste` and `Unsafe Worksite` still dispatch a truck, for 15 min and $0 of materials. No new evaluation rule or reason code.
- **A3 priority/SLA:** stays the v1 constant (STANDARD, 24h).
- **Unknown or null descriptor:** the generic repair profile (60 min, $200), plus an `UnknownDescriptor` warn log naming the descriptor. Known long-tail descriptors map to the same profile explicitly, so the log only fires for genuinely new ones.

| Descriptor | Minutes | Materials |
|---|---|---|
| Pothole | 30 | $75 |
| Cave-in | 120 | $600 |
| Defective Hardware | 60 | $250 |
| Rough, Pitted or Cracked Roads | 90 | $400 |
| Failed Street Repair | 60 | $200 |
| Plate Condition (Noisy, Shifted, Open, Anti-Skid) | 30 | $50 |
| Line/Marking (Faded, After Repaving) | 45 | $150 |
| Crash Cushion Defect, Guard Rail - Street | 90 | $500 |
| Blocked - Construction, Dumpster - Construction Waste, Unsafe Worksite (inspection) | 15 | $0 |
| Depression Maintenance, Wear & Tear, Hummock, General Bad Condition, unknown/null | 60 | $200 |

**Fleet re-sizing (Q1):** weighted by real Jul–Sep 2026 volume, the average job is **61 min base, ~91 min with variance** (Q1 assumed 45), and materials average **$252 estimated, ~$377 actual**. At BBL-only volume (~110 jobs/day) with ~30 min transit, that's **~9–10 trucks at 100%, ~13 with headroom**, up from 8–10. Cave-ins (28% of volume at 120 min) dominate. Re-check against real utilization at the Part E check-ins.

### Q6 — Every Request becomes an Order (2026-09-28)
**Decision: keep as-is. This is intentional, not a placeholder.** Every
ingested complaint that has a BBL and isn't already closed becomes an Order.
Non–Street Condition Orders are rejected with `reason_code:
SERVICE_NOT_SUPPORTED` (Q2), so the Orders table and `wbr` hold the complete
NYC funnel. Cost is negligible: Test's DynamoDB spend was $0.62 over 30 days
for 509k Requests and 1.7M Order items. No revisit trigger was set. The
AWS Budget (B2) is the general cost backstop.

### Q7 — Visible feature deferrals (2026-09-28)
- **A11 failure injection / chaos config (#36): deferred to v2.** A note goes into CLAUDE.md §5.2 that the convention isn't implemented yet.
- **A12 Total Cost: a must-have for launch.** `wbr` gains `total_cost` (labor + material cost from the Q5 descriptor model). The updated `wbr` query is applied by hand, in Test first and then in Prod (Part D step 6). Cost *prediction* and the ML cost model (doc 11 §5/§6) stay deferred to v2.
- **A14 About page "Machine Learning" / "LLMs": intentionally left as "Work in progress".** AI is planned for v2.

### Q8 — Alerting and cost guardrails (2026-09-28)
- **B1: manually subscribe seththeeke@gmail.com** to each alarm topic that has no subscriber, and confirm (Part D step 2). Worth recording: CDK *declares* these `EmailSubscription`s, but an unconfirmed subscription gets deleted by AWS while CloudFormation still thinks it exists. So "declared in CDK" doesn't mean "delivering".
- **B2: an AWS Budget in CDK at $20/month** with email alerts. It's a pre-launch build item. Implementation note to settle at build time: a budget covers the whole account, so declaring it in `Nyc311Stack` would create two (Test + Prod). My recommendation is a construct created **only when `envName === "PROD"`**, following the poller `MetricFilter`s' existing Prod-only precedent, and scoped to all account costs (CodeBuild/CodePipeline included). Alert on actual spend at 80% and 100%, plus forecasted spend at 100%.
- **B6/#25: defer additional alarms.** Alarms and custom log metrics cost real money. This includes the `ExecutionsFailed` alarm listed in Q3 and the Firehose `DataFreshness` alarm I suggested. The known risk we're accepting: if Firehose stalls, `wbr` keeps succeeding on stale data. Mitigation: check freshness by hand during the Part E check-ins.

### Q9 — Deploy safety and dial-up control (2026-09-28)
- **B3: crude abuse protection, no added cost.** The goal is that this portfolio project can't be turned into a bill or an outage by a scraper. The pre-launch build item:
  - A **default throttle on the `Nyc311Api` `$default` stage**: roughly 10 rps steady, burst 20. The exact numbers get checked at build time against the web app's real polling rate.
  - **Tighter per-route throttles on the expensive public routes**: `GET /fleet/locations` (1769 MB Lambda) and `GET /lambda-metrics` (48 CloudWatch calls per hit).
  - Accepted limitation: HTTP API throttling is per stage/route, **not per client IP**. One abuser can use up the budget and everyone gets 429s. That's acceptable. The failure mode is "site briefly unavailable", not "surprise bill". Per-IP limits would need AWS WAF (~$5+/month base), which I rejected for cost.
- **B4: no manual approval. Full CD with no human gate is a core principle for this project.** Consequence: the **Test-stage blocking integration tests are Prod's only gate**. Pipeline reliability (the current `DeployTest` failures, and #34's Vitest RPC-timeout flake) therefore matters more after launch. A flaky gate either blocks every release or tempts you to weaken it.
- **B5: a `pollerEnabled` flag per environment** in `Nyc311Stack` sets `Nyc311PollerSchedule`'s `state`. Prod starts `false`, which matches today's console state. The dial-up is a reviewed commit flipping it to `true`.

### Q10 — Engineering health (2026-09-28)
- **#54 (web-app coverage broken on Node 22+): must-have, and first in build order.** Every web-app build item (Q2's nullable `location_id`, any Q5/Q7 UI) needs a passing web-app Operational Loop.
- **#48 (happy-dom critical advisory): must-have**, done in the same change as #54. The major bump may fix #54 on its own. If it doesn't, apply #54's planned test-setup fix.
- **#34 (CDK Vitest RPC-timeout flake): deferred.** Under full CD (Q9) the Test integration tests are Prod's only gate, so fix it promptly if it starts blocking releases again.
- **#40 (`order_snapshots` dedup key): must-have, pending a deeper investigation** before choosing the fix. Candidates: dedup by `last_event_sequence`, or a documented view/CTE convention every job uses.
- **#37 (`event_name` documented but never warehoused): must-have.** Either get `event_name` onto the rows (e.g. stamp it in the payload before SNS/Firehose, or enrich it in the transform Lambda) or correct doc 7 and the schema. Decide which during the fix, and **prefer making it real** so the Glue schema and doc 7 match reality.

### Q11 — Security hygiene (2026-09-28)
- **A15: must fix.** Admin credentials, even mock ones, must not appear in the public Prod bundle. The approach is decided at build time. One candidate is loading mock services/test data only in mock mode via dynamic `import()`. The fix should come with a check that proves it: e.g. a pipeline step or test that greps `web-app/dist` for the mock credential or `test-data` markers and fails the build if they're found. Also confirm the real Cognito admin password isn't the same as the mock one, and rotate it if it is.
- **B9: enable `deletionProtection` on every Prod DynamoDB table** (`Requests`, `Orders`, `Operators`, `Locations`, `Users`, `FeatureFlags`, `WarehouseJobRuns`), set by `envName` in the table constructs. Test stays unprotected.
- **B10: MFA deferred.** Single admin, with a capped blast radius.

### Q12 — Backlog and launch logistics (2026-09-28)
- **Deferred for v1:** #5, #9, #24, #51, and #34 (Q10). The stale "Leg 3 not built" comments (B11) get fixed inside F4 rather than as a separate item.
- **Forward-only ingestion.** No old requests. Prod's existing cursor (`2026-08-13`) and the no-cursor 24h lookback would both backfill, so the cursor is overwritten by hand to the dial-up time immediately before the poller is enabled (Part D step 11).
- **The fleet is created by hand only, never programmatically.** You'll create the initial Prod fleet yourself, likely 5–10 vehicles, through the admin Capacity page (Part D step 10). No seed script is ever pointed at Prod.
