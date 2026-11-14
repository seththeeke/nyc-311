# 194. Dispatch the nearest idle operator to each order, not whichever the index returns first

**Status:** Spec created 2026-11-13. **Ticket:** #194. **Card:** Spec Created.

## 1. Ticket

The scheduling run (`orderSchedulingService.ts` `dispatchOneOrder`) claims
whichever idle operator `OperatorDao.findIdleOperator()` returns first
(`gsi1-availability`, `Limit: 1`, oldest tenure). It reads the job's location
only after that, so distance plays no part. Operators are paid for the drive,
and today's pick is no better than random: 8.16 mi actual against 8.69 mi
for a random pair in the same tick, with the nearest operator 3.22 mi away.

This project makes the run claim the **nearest idle operator** to each order,
greedily, in today's order priority (oldest `sla_deadline` first), behind
the backend flag `NEAREST_OPERATOR_DISPATCH`. Orders whose location falls
back to `HOME_DEPOT_LOCATION` (missing lat/lng) keep first-available.
#170's event-driven dispatch is out of scope (Rex, 11-09).

## 2. Verification

**Ticket's block:** drive distance from the saved `nearest-operator-bounds`
query, target ≤ 5.5 mi (from 8.69) within 7 days at 100%; driving share of
paid hours ≤ 15% (from 19-24%); guardrails on time to resolve, SLA, skips
and claim conflicts.

| # | What | How | Before (measured 2026-11-13) | Proves it works |
|---|---|---|---|---|
| V1 **(decides)** | Average operator-to-job drive distance | Warehouse, query Q1 below, 3-day window | **8.16 mi** (p50 7.31), Nov 10-12, 396 jobs, 52 ticks. Same-tick all-pairs 8.69 mi, nearest 3.22 mi | ≤ 5.5 mi over the 7 days at 100% T1, and clearly below that window's all-pairs average |
| V2 | Distance logged per dispatch | CloudWatch Logs Insights on `/aws/lambda/Nyc311OrderScheduling-<Env>`: `filter msg = "OrderScheduleEstimated" \| stats avg(distanceMiles), count(*) by dispatchTreatment` | Field doesn't exist today (`OrderScheduleEstimated` logs no distance) | Test, 2 days at T1: every row has `dispatchTreatment = "T1"`, and `distanceMiles ≤ min(alternativeMiles)` on every non-fallback row. Prod at C (after Leg 1): a live log "before" next to V1 |
| V3 | Transit hours per dispatched job (demand-neutral) | Q2's `transit_h` ÷ Q1's `jobs`, same window | ≈ **0.53 h/job** (209.0 h ÷ 396, Nov 10-12, approximate) | Falls in step with V1 |
| V4 | Driving share of paid hours (ticket's second metric) | Q2, per day | 21.2, 21.7, 22.2, 19.9, 16.1, 16.6, **11.0%** (Nov 6-12) | Reported, not deciding: see below |
| V5 | Unit tests | Vitest, both treatments | n/a | C picks first-available exactly as today; T1 picks nearest, honours the conflict cap and the fallback rule |

**Why V4 doesn't decide.** Demand fell from Nov 10: idle hours went from
75 to 336 a day, and the driving share dropped to 11.0% on Nov 12 with no
code change, already under the ticket's 15% target. A share of paid hours
moves with demand, so it can't tell this change apart from a slow week. V1
(miles per job) and V3 (hours per job) don't depend on demand, so V1
decides and V3 backs it up.

**Guardrails** (abort rule in §5):

| Guardrail | Threshold | Before |
|---|---|---|
| Median time to resolve, resolved orders (Q3) | not up > 5% | **173.72 h** (1,090 orders resolved Nov 6-12) |
| Share resolved after `sla_deadline` (Q3) | not up > 2 pts | **69.1%** (same) |
| `SKIPPED_NO_CAPACITY` while idle operators exist | not up | Not measurable yet: T1 logs `idleOperatorCount` per run (Leg 2); C's comes from `OrderSchedulingRunCompleted` |
| Claim conflicts past the cap | 0 `OrderScheduleClaimAttemptsExhausted` with idle operators left | Event doesn't exist yet |

**Q1, drive distance (V1, V3):**

```sql
WITH ev AS (
  SELECT DISTINCT operator_id, sequence_number, event_type, occurred_at, payload
  FROM operator_events WHERE dt >= '2026-11-09'
),
seq AS (
  SELECT operator_id, event_type, from_iso8601_timestamp(occurred_at) AS ts,
    CAST(json_extract_scalar(payload, '$.location.lat') AS double) AS lat,
    CAST(json_extract_scalar(payload, '$.location.lng') AS double) AS lng,
    LEAD(event_type) OVER (PARTITION BY operator_id ORDER BY sequence_number) AS next_type,
    LEAD(CAST(json_extract_scalar(payload, '$.location.lat') AS double)) OVER (PARTITION BY operator_id ORDER BY sequence_number) AS job_lat,
    LEAD(CAST(json_extract_scalar(payload, '$.location.lng') AS double)) OVER (PARTITION BY operator_id ORDER BY sequence_number) AS job_lng
  FROM ev
),
d AS (
  SELECT row_number() OVER () AS id, operator_id, date_trunc('hour', ts) AS tick, lat, lng, job_lat, job_lng
  FROM seq
  WHERE event_type = 'TRANSIT_STARTED' AND next_type = 'WORK_STARTED'
    AND ts >= from_iso8601_timestamp('2026-11-10T00:00:00Z') AND ts < from_iso8601_timestamp('2026-11-13T00:00:00Z')
    AND lat IS NOT NULL AND job_lat IS NOT NULL
),
pairs AS (
  SELECT j.id AS job, o.id AS op, j.tick,
    2 * 3958.8 * asin(sqrt(power(sin(radians(j.job_lat - o.lat) / 2), 2)
      + cos(radians(o.lat)) * cos(radians(j.job_lat)) * power(sin(radians(j.job_lng - o.lng) / 2), 2))) AS mi
  FROM d j JOIN d o ON j.tick = o.tick
),
per_job AS (
  SELECT job, MAX(CASE WHEN job = op THEN mi END) AS actual_mi, MIN(mi) AS nearest_mi FROM pairs GROUP BY job
)
SELECT (SELECT COUNT(DISTINCT tick) FROM d) AS ticks, COUNT(*) AS jobs,
  ROUND(AVG(actual_mi), 2) AS avg_actual_mi, ROUND(approx_percentile(actual_mi, 0.5), 2) AS p50_actual_mi,
  (SELECT ROUND(AVG(mi), 2) FROM pairs) AS avg_all_pairs_mi, ROUND(AVG(nearest_mi), 2) AS avg_nearest_op_mi
FROM per_job
```

**Q2, fleet time by activity (V3, V4):** `operator_events` (`dt >=
'2026-10-01'`, deduped), each event to the operator's next (or now), classed
by its opening event (`TRANSIT_STARTED` drive, `WORK_STARTED` work,
`OPERATOR_ADDED`/`WORK_COMPLETED`/`WORK_ABORTED`/`OPERATOR_REMOVAL_REQUESTED`
idle, `OPERATOR_REMOVED` unpaid), summed by start day for Nov 6-12; drive
% = transit ÷ paid. This is the `fleet-time-budget-daily` idiom.

**Q3, guardrails:** `order_events` (deduped): per order, the first
`ORDER_CREATED` and the last `ORDER_RESOLVED`; resolved Nov 6-12; the median
hours created → resolved; % resolved after the latest snapshot's
`sla_deadline`.

For the after-window, each query is re-run with its dates moved.

## 3. Flag

| | |
|---|---|
| Key | `NEAREST_OPERATOR_DISPATCH` (confirmed absent 2026-11-13) |
| `C` | First-available: `findIdleOperator()` per order, exactly as today |
| `T1` | Nearest idle operator per order (greedy), first-available for fallback-location orders |
| Read | Once per run, at the top of `scheduleOrders`, through #202's `featureFlagService.getTreatment("NEAREST_OPERATOR_DISPATCH", {}, { fallback: "C" })`. Empty context: the run is the unit, since both treatments draw on one pool of idle operators. A missing flag, a DynamoDB error or an unknown treatment means `C`, with a WARN. The treatment is logged on `OrderSchedulingRunStarted` and on every `OrderScheduleEstimated` |
| Rows | `FeatureFlags-Test`: default `T1`. `FeatureFlags-Prod`: default `C`, no allocations |

## 4. Legs

| Leg | Change | Packages | Depends on | Verified by | PR | State |
|---|---|---|---|---|---|---|
| 1 | Read the flag once per run, falling back to `C`. Grant the scheduling Lambda `dynamodb:GetItem` on the FeatureFlags table and pass `FEATURE_FLAGS_TABLE_NAME`. Add `dispatchTreatment` and `distanceMiles` (`pathPlanningService.getDistance`, operator to job) to `OrderScheduleEstimated`. No change to the choice | `backend/` (`orderSchedulingService.ts`), `cdk/` (`Nyc311OrderSchedulingLambda.ts`) | **#202** (backend flag reads) | V5 (C unchanged, flag read once, fallback on error); V2 in Prod at C: the live "before" | | Not started |
| 2 | Under `T1`: `OperatorDao.listIdleOperators()` (the same `gsi1-availability` Query, paginated, capped at 200, no `Limit: 1`), read once per run into an in-memory pool. Per order: read the location first. A fallback location takes the oldest-tenured operator in the pool. Otherwise, sort the pool by distance to the job and `startTransit` up to 3 candidates (`MAX_CLAIM_ATTEMPTS`), dropping each `ConflictError` from the pool. Past the cap, log `OrderScheduleClaimAttemptsExhausted` and return `SKIPPED_NO_CAPACITY`. A claimed operator leaves the pool. Log `idleOperatorCount`, `jobLocationFallback` and `alternativeMiles` (next 3) | `backend/` (`operatorDao.ts`, `orderSchedulingService.ts`, a new `nearestOperatorSelector.ts`) | Leg 1 merged | V5 (both treatments, cap, fallback, conflict path); V2 in Test at T1 | | Not started |

Each leg is one PR that ships dark (`C` in Prod) and runs the Operational
Loop in every package it touches. Removing `C`'s code path and the flag is a
separate cleanup issue, filed once the outcome is recorded.

## 5. Dial-up plan

1. **Test, `T1`, 2 days** after Leg 2 deploys: V2 daily (every dispatch
   `T1`, `distanceMiles ≤ min(alternativeMiles)`, no
   `OrderScheduleClaimAttemptsExhausted` while the pool still has idle
   operators), and no rise in `ordersFailed` on `OrderSchedulingRunCompleted`.
2. **Prod `C`** until then (it ships dark), with V1 and V2 giving a fresh
   7-day "before".
3. **Prod 100% `T1` in one step**, held 7 days. Splitting a run's traffic
   doesn't work: both treatments draw on the same idle operators. Check
   each day: V1 (3-day trailing), V3, Q3's guardrails, and the skip and
   conflict logs.
4. **Abort:** any guardrail past its threshold (§2), or V1 above the
   same window's all-pairs average after 3 days → flag back to `C`, with a
   comment on #194.
5. **Outcome** after 7 days: V1 ≤ 5.5 mi is a win.

## 6. Verification log

| Date | Step | Result | Numbers |
|---|---|---|---|
| 2026-11-13 | Before | Baselines recorded (§2) | 8.16 mi actual, 8.69 all-pairs, 3.22 nearest; ≈0.53 transit h/job; median resolve 173.72 h, 69.1% late |

## 7. Outcome

Not yet.

## 8. Needs the CEO

- Create the flag rows (§3): `FeatureFlags-Test` default `T1`,
  `FeatureFlags-Prod` default `C`.
- #202 must ship first. It is in Intake today.
- V2 and the skip guardrail need read-only CloudWatch Logs access. The
  `nyc311-gen-purpose-dev` AWS profile isn't configured on the host
  (checked 2026-11-13).

## Appendix: decisions

- **Greedy nearest per order, in priority order** (Rex, Celestine,
  11-09). With about 7 jobs a tick, a full assignment solve gains little
  and adds a dependency. Urgency still decides the order; distance decides
  the operator.
- **Fallback-location orders keep first-available** (resolved 11-09). They
  take the oldest-tenured operator in the pool, which is what `C` would
  pick.
- **One idle-operator read per run, not per order.** Under `T1`, the pool is
  read once and shrinks as operators are claimed. An operator who frees up
  mid-run is picked up next run (runs take seconds). `startTransit`'s
  conditional claim still guards against a stale pool.
- **`C` keeps `findIdleOperator()` untouched**, so the control path is
  byte-for-byte today's behaviour and the flag can always fall back to it.
- **Cap of 3 claim attempts:** conflicts only come from overlapping runs
  (A10), so more than one in a row is already rare. Three bounds a burst
  without giving up too soon.
- **Distance metric:** V1 uses haversine and `getDistance` is a flat-earth
  approximation. They differ by well under 1% at NYC's scale, so the logged
  and warehouse numbers are comparable.
- **Rejected:** driving share as the deciding metric (§2, it moves with
  demand); a per-order traffic split (shared pool); coupling to #170 (Rex:
  separate scope).
- **Ticket numbers vs mine:** the ticket's 8.69 mi "actual" over its window
  matches my all-pairs average for Nov 10-12. My actual is 8.16 mi. Either
  way, the pick is within about 6% of random. The target (≤ 5.5 mi) stands.
