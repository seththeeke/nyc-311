# 170. Dispatch the next order the moment an operator frees up, not only on the hourly scheduling run

**Status:** Spec created 2026-11-14. **Ticket:** #170. **Card:** Spec Created.

## 1. Ticket

Only one thing assigns an order to an operator: the `rate(1 hour)` scheduling
run (`Nyc311OrderSchedulingSchedule.ts`). Every job start in Prod lands at
minute :22. When an operator frees up, or an order is accepted, the work
waits for the next tick, about 30 minutes on average. The fleet is paid for
that wait.

This project adds an **event trigger** next to the hourly run. When an
operator becomes free (`WORK_COMPLETED`, `WORK_ABORTED`, `OPERATOR_ADDED`)
or an order is accepted (`ORDER_ACCEPTED`), the unchanged `scheduleOrders`
pass runs at once. The trigger sits behind the backend flag
`EVENT_DRIVEN_DISPATCH`. The hourly run stays as it is under both
treatments. First, the project closes the operator-claim race in
`OperatorDao.startTransit`, because event triggers make overlapping passes
the normal case. The two are agreed to ship together (Rex and Celestine,
11-08).

## 2. Verification

**Ticket's block:** idle share of paid fleet hours on days the backlog stays
above zero (target under 5%, from 18-20%). Median gap from `WORK_COMPLETED`
to the next `TRANSIT_STARTED` (target under 2 min, from ~30). The spread of
`TRANSIT_STARTED` across minutes of the hour (today 100% at :22). Guardrails:
no double claims, scheduling error rate under 1% with no throttles, median
time to resolve doesn't rise.

| # | What | How | Before (measured 2026-11-14) | Proves it works |
|---|---|---|---|---|
| V1 **(decides)** | **Match delay** per dispatch: `ORDER_SCHEDULED` time minus the later of (the order's first `ORDER_ACCEPTED`, the scheduled operator's last `WORK_COMPLETED`/`WORK_ABORTED`/`OPERATOR_ADDED`). It's how long a waiting order and a free operator sat together before the dispatch | Warehouse, Q3 | Nov 7-12, daily: p50 **27.4-38.7 min**, avg **28.7-33.0 min**, p90 52-55 min, **0.6-4.5%** within 2 min (935 dispatches) | Over the 7 days at 100% `T1`: p50 under 2 min, and at least 90% within 2 min |
| V2 | Gap from `WORK_COMPLETED`/`WORK_ABORTED` to the same operator's next `TRANSIT_STARTED` (ticket's metric) | Q1 | p50 28.1, 29.1, 28.3 min (Nov 7-9, backlog never empty); 34.0-47.7 (Nov 10-12); 648 (Nov 13, almost no demand) | Under 2 min on days the backlog stays above zero |
| V3 | Share of `TRANSIT_STARTED` at the most common minute of the hour | Q1 | **100% at :22, every day** Nov 7-13 | Well below 100%. Reported, not deciding (see below) |
| V4 | Idle share of paid hours on days the backlog never empties (ticket's metric) | Q1 (idle %) where Q2's `backlog_min_hourly > 0` | 20.2, 18.9, 18.7% (Nov 7-9, backlog min 409/242/57). Nov 10-13 don't qualify (the backlog emptied each day; idle 33.5-88.1%) | Under 5%, if qualifying days occur |
| V5 | Accept → scheduled, p50 per day of acceptance (Celestine's queue baseline) | Q2 | 2.70, 4.32, 1.64 h (Nov 10-12) | Falls. Reported |
| V6 | Event trigger runs and obeys the flag | CloudWatch Logs Insights on `/aws/lambda/Nyc311OrderSchedulingOnEvent-<Env>`: `filter message in ["EventDrivenSchedulingSkipped", "OrderSchedulingRunCompleted"] \| stats count(*) by treatment, triggerEventType` | The Lambda doesn't exist | Test at `T1`: runs for all four event types, no skips. Prod at `C`: only `EventDrivenSchedulingSkipped` |
| V7 | Tests | Vitest | n/a | Two truly concurrent `startTransit` calls, interleaved so both read IDLE before either writes: exactly one wins, and the other gets `ConflictError` or a cancelled transaction that `dispatchOneOrder` counts as a skip. The event service under `C` (no pass) and `T1` (one pass). Never relied on alone |

**Why V1 decides, not V4.** The backlog emptied on every day from Nov 10
(Q2), so idle share now mostly measures demand: 88% on Nov 13 with only 14
dispatches. There may be no "backlog above zero" days in the after-window
at all. V1 measures each dispatch, so demand doesn't move it: 28.7-33.0 min
on average both with a 409-order backlog and with an empty one. Under `T1`,
the only delay left is the stream → SNS → Lambda hop (seconds) and a lost
claim, so V1 is the direct measure of this change. V2 and V4 are reported
alongside it, as the ticket asks.

**Guardrails** (abort rule in §5):

| Guardrail | Threshold | Before |
|---|---|---|
| Double claims: an operator's `TRANSIT_STARTED` followed directly by another `TRANSIT_STARTED` (Q3) | 0 | **0** since Oct 1 |
| Errors on the event Lambda (CloudWatch `Errors` ÷ `Invocations`) | under 1% | Lambda doesn't exist |
| Throttles on both scheduling Lambdas (CloudWatch `Throttles`) | 0 | Not measured: no AWS profile on the host (§8) |
| `OrderScheduleFailed` per day, both Lambdas | not up | Not measured (same) |
| Median time to resolve, resolved orders | not up > 5% | 173.72 h (resolved Nov 6-12, taken 2026-11-13 for #194) |

**Q1, operator side (V2, V3, V4):** `operator_events` (`dt >=
'2026-10-01'`, deduped on `(operator_id, sequence_number)`). Each event runs
to the operator's next event (or now) and is classed by its opening event:
`TRANSIT_STARTED` drive, `WORK_STARTED` work, `OPERATOR_ADDED`/`WORK_COMPLETED`/
`WORK_ABORTED`/`OPERATOR_REMOVAL_REQUESTED` idle, `OPERATOR_REMOVED` unpaid.
Grouped by the UTC day it starts on: the p50/p90 minutes from a
`WORK_COMPLETED`/`WORK_ABORTED` whose next event is `TRANSIT_STARTED`;
`TRANSIT_STARTED` count and share at the top `minute(ts)`; transit, work
and idle hours and idle %. (`fleet-time-budget-daily` idiom.)

**Q2, order side (V4's filter, V5):** `order_events` (`dt >= '2026-10-15'`,
deduped). Per order: the first `ORDER_ACCEPTED`, and the first
`ORDER_SCHEDULED` at or after it. The backlog is sampled at :30 of every
hour as accepted-and-not-yet-scheduled, then its daily min and max. The
accept → scheduled p50 is grouped by the day of acceptance.

**Q3, match delay and double claims (V1, guardrail):**

```sql
WITH oe AS (
  SELECT DISTINCT order_id, sequence_number, event_type, occurred_at, payload
  FROM order_events WHERE dt >= '2026-10-15' AND event_type IN ('ORDER_ACCEPTED','ORDER_SCHEDULED')
),
acc AS (SELECT order_id, MIN(from_iso8601_timestamp(occurred_at)) AS acc_ts FROM oe WHERE event_type = 'ORDER_ACCEPTED' GROUP BY 1),
sch AS (
  SELECT order_id, from_iso8601_timestamp(occurred_at) AS sched_ts, json_extract_scalar(payload, '$.operator_id') AS operator_id
  FROM oe WHERE event_type = 'ORDER_SCHEDULED'
    AND from_iso8601_timestamp(occurred_at) >= from_iso8601_timestamp('2026-11-07T00:00:00Z')
    AND from_iso8601_timestamp(occurred_at) < from_iso8601_timestamp('2026-11-14T00:00:00Z')
),
pe AS (SELECT DISTINCT operator_id, sequence_number, event_type, occurred_at FROM operator_events WHERE dt >= '2026-10-01'),
free AS (
  SELECT s.order_id, s.sched_ts, MAX(from_iso8601_timestamp(p.occurred_at)) AS free_ts
  FROM sch s JOIN pe p ON p.operator_id = s.operator_id
   AND p.event_type IN ('WORK_COMPLETED','WORK_ABORTED','OPERATOR_ADDED')
   AND from_iso8601_timestamp(p.occurred_at) < s.sched_ts
  GROUP BY 1, 2
),
m AS (
  SELECT date(f.sched_ts AT TIME ZONE 'UTC') AS day,
    date_diff('second', greatest(a.acc_ts, f.free_ts), f.sched_ts) / 60.0 AS delay_min
  FROM free f JOIN acc a ON a.order_id = f.order_id
),
dc AS (
  SELECT COUNT(*) AS n FROM (
    SELECT event_type, LEAD(event_type) OVER (PARTITION BY operator_id ORDER BY sequence_number) AS nt FROM pe
  ) WHERE event_type = 'TRANSIT_STARTED' AND nt = 'TRANSIT_STARTED'
)
SELECT day, COUNT(*) AS dispatches,
  ROUND(approx_percentile(delay_min, 0.5), 1) AS delay_p50_min,
  ROUND(AVG(delay_min), 1) AS delay_avg_min,
  ROUND(approx_percentile(delay_min, 0.9), 1) AS delay_p90_min,
  ROUND(100.0 * COUNT_IF(delay_min <= 2) / COUNT(*), 1) AS pct_within_2_min,
  MAX((SELECT n FROM dc)) AS double_claims_since_oct1
FROM m GROUP BY day ORDER BY day
```

For the after-window, each query is re-run with its dates moved.

## 3. Flag

| | |
|---|---|
| Key | `EVENT_DRIVEN_DISPATCH` (confirmed absent 2026-11-14) |
| `C` | Ignore the event: log `EventDrivenSchedulingSkipped` and return. Dispatch stays hourly-only, as today |
| `T1` | Run `scheduleOrders()` on the event |
| Read | Once per event, in `service/scheduling/eventDrivenSchedulingService.ts`, through #202's `featureFlagService.getTreatment("EVENT_DRIVEN_DISPATCH", {}, { fallback: "C" })`. The context is empty because every event shares one fleet. A missing flag, a DynamoDB error or an unknown treatment means `C`, with a WARN. `treatment` and `triggerEventType` are logged on every outcome. The hourly Lambda never reads it |
| Rows | `FeatureFlags-Test`: default `T1`. `FeatureFlags-Prod`: default `C`, no allocations |

## 4. Legs

| Leg | Change | Packages | Depends on | Verified by | PR | State |
|---|---|---|---|---|---|---|
| 1 | Close the claim race. `startTransit` keeps its outer pre-check as a cheap early exit, and also re-checks `ACTIVE`/`IDLE`/no `removal_requested_at` inside `foldProjection` against `appendEvent`'s fresh read, throwing `ConflictError` there. `dispatchOneOrder` treats a `TerminalError` from `startTransit` whose cause is a `TransactionCanceledException` as a lost claim: it logs `OrderScheduleSkippedOperatorClaimConflict` with `reason: "TRANSACTION_CANCELLED"` and returns `SKIPPED_NO_CAPACITY`. The `startTransit`/`findIdleOperator` doc comments are corrected. `OrderSchedulingRunStarted` logs `trigger` (`SCHEDULE` for the hourly run) | `backend/` (`operatorDao.ts`, `orderSchedulingService.ts`) | none | V7 (concurrent claim test); double-claim guardrail stays 0 in Prod | | Not started |
| 2 | The event trigger, dark. A new controller `controller/order-processing/scheduleOrdersOnEventController.ts` validates the SNS event with zod (`Records[].Sns.MessageAttributes.event_type`, one of the four types) and calls `scheduleOrdersOnEvent({ triggerEventType })` in a new `service/scheduling/eventDrivenSchedulingService.ts`, which reads the flag (§3) and either skips or calls `scheduleOrders({ trigger: "EVENT" })`. A new construct `cdk/lambda/Nyc311OrderSchedulingOnEventLambda.ts` (`Nyc311OrderSchedulingOnEvent-<Env>`) carries the scheduling Lambda's env and grants plus `dynamodb:GetItem` on FeatureFlags and `FEATURE_FLAGS_TABLE_NAME`. It is subscribed to `Nyc311OrderEvents` (filter `event_type`: `ORDER_ACCEPTED`) and `Nyc311OperatorEvents` (filter `WORK_COMPLETED`, `WORK_ABORTED`, `OPERATOR_ADDED`). Async-invoke failures go to `Nyc311OrderSchedulingOnEventDlq-<Env>`, with an errors alarm like `Nyc311OrderSchedulingSchedule`'s. No reserved concurrency | `backend/`, `cdk/` (`Nyc311Stack.ts` wiring) | Leg 1 merged; **#202** (backend flag reads) | V7 (both treatments); V6 in Test at `T1`, then in Prod at `C` | | Not started |

Each leg is one PR that ships dark and runs the Operational Loop in every
package it touches. Leg 1 changes no behaviour while passes don't overlap,
which is always true while dispatch is hourly-only (§Appendix). Removing the
flag and `C`'s skip path is a separate cleanup issue, filed once the outcome
is recorded.

## 5. Dial-up plan

1. **Test, `T1`, 2 days** after Leg 2 deploys: V6 daily (passes fire on all
   four event types), V7's concurrent-claim test passing in the pipeline,
   no double claims, no event-Lambda errors or throttles.
2. **Prod `C`** until then (Leg 2 ships dark). V6 shows only skips.
3. **Prod 100% `T1` in one step**, held 7 days and checked daily: V1
   (trailing 1 day), the double-claim count, the event Lambda's errors and
   both Lambdas' throttles, `OrderScheduleFailed`, and median time to
   resolve. A per-event split would blur V1, since every event draws on the
   same fleet.
4. **Abort:** any double claim, or any guardrail past its threshold (§2) →
   flag back to `C`, with a comment on #170. Back at `C` the system is
   exactly today's hourly dispatch.
5. **Outcome** after 7 days: V1 p50 under 2 min with at least 90% within
   2 min is a win. V2-V5 are recorded alongside it.

## 6. Verification log

| Date | Step | Result | Numbers |
|---|---|---|---|
| 2026-11-14 | Before | Baselines recorded (§2) | Match delay p50 27.4-38.7 min, 0.6-4.5% within 2 min (Nov 7-12); 100% of starts at :22; idle 18.7-20.2% on backlog days (Nov 7-9); 0 double claims since Oct 1 |

## 7. Outcome

Not yet.

## 8. Needs the CEO

- Create the flag rows (§3): `FeatureFlags-Test` default `T1`,
  `FeatureFlags-Prod` default `C`.
- #202 must ship before Leg 2. It's in Intake today. Leg 1 doesn't need it.
- The throttle, error and `OrderScheduleFailed` guardrails and V6 need
  read-only CloudWatch access. The `nyc311-gen-purpose-dev` AWS profile
  isn't configured on the host (checked 2026-11-14).
- Confirm the trigger events (Appendix, first bullet). They differ from the
  ticket's `ORDER_RESOLVED`.

## Appendix: decisions

- **`WORK_COMPLETED` on the operator topic, not `ORDER_RESOLVED`.**
  `resolveOrder` (`orderExecutionService.ts`) appends `ORDER_RESOLVED`
  *before* `completeWork` moves the operator to `IDLE`. A pass fired on
  `ORDER_RESOLVED` can therefore find the operator still `WORKING`, and the
  order would wait for the hourly run. `WORK_COMPLETED` is the moment the
  operator is free. `WORK_ABORTED` (a failed execution returns the operator
  to idle) and `OPERATOR_ADDED` (Brogan's hires) free capacity the same way,
  so they trigger a pass too. The hourly run still covers anything missed.
  `Nyc311OperatorEvents` already tags every event with `event_type`, so this
  is a filter policy, not new publishing code.
- **A separate Lambda, not a second trigger on `Nyc311OrderScheduling`.**
  The hourly Lambda and its controller stay byte-for-byte as they are. Each
  trigger gets its own error and throttle metrics for the guardrails, and
  rolling back is the flag alone.
- **Leg 1 isn't flagged.** It only adds a check against a fresher read, plus
  a skip where today's code throws. With hourly-only dispatch, passes never
  overlap, so `C` behaviour is unchanged. Rex and Celestine made it a
  prerequisite of the event trigger (11-08). Flagging it would leave the
  race open under `T1`'s first deploy.
- **Settled on the ticket, not reopened:** the hourly run stays at
  `rate(1 hour)`. One invocation per event, with no debounce, SQS batching
  or FIFO, at about 105 jobs a day. No "claim one order" path: the full
  pass (bounded at 200 orders) is the handler's body.
- **Overlapping passes after Leg 1.** Two passes can pick the same idle
  operator: one wins, and the other skips that order and moves on. Any
  order left over is picked up by the next event or the hourly run.
- **GSI lag.** An `ORDER_ACCEPTED` pass could, in principle, run before the
  order appears on `gsi1-stage-sla`. The stream → SNS → Lambda hop usually
  takes longer than GSI propagation, and the hourly run is the backstop.
  V1's p90 will show it if it matters.
- **Interplay with #194** (Spec Created): both change
  `orderSchedulingService.ts`, and both need #202. Whichever lands second
  rebases. They use separate flags and are measured by different metrics
  (minutes waited vs miles driven).
- **Rejected:** idle share as the deciding metric (§2: since Nov 10 it
  moves with demand); V3's minute spread as a decider (accepted orders
  arrive in 6-hourly bursts that may share a minute).
- **Ticket numbers vs mine:** the ticket's 739 job starts, all at :22, and
  ~30 min median gap (Nov 1-7) agree with Q1 for Nov 7-9 (169-192 starts a
  day, p50 28-29 min, 100% at :22).
