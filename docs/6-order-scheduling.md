# Order Scheduling — Job-Based Prioritized Dispatch Against Mock Capacity

> **Negotiated 2026-08-28.** Follows `5-order-evaluation.md`'s `ACCEPT`
> outcome, which already moves an `Order` to `current_stage: "SCHEDULE"`
> and stamps `priority_tier`/`sla_deadline` (today, both mocked constants).
> This doc owns what happens next: dispatching those waiting Orders against
> capacity, per `capacity-model.md` §8's `Schedule` stage definition
> ("takes current pool capacity, transit-time ETA, and processing-time ETA,
> and computes the next available slot").
>
> **Deliberately job-based, not event-driven** — the opposite shape from
> `5-order-evaluation.md`'s choreographed fan-out. A dispatch decision is
> inherently cross-Order (who gets the next open slot depends on the whole
> waiting queue's relative priority, not just the Order that happens to
> have just arrived), so there's no single `OrderEvent` to react to that
> would trigger the right computation. `ddb-design.md` already built
> `gsi1-stage-sla` for exactly this: "Capacity engine's dispatch loop:
> `Query gsi1pk = "STAGE#Schedule"` sorted ascending by `sla_deadline`
> returns the queue in the exact order it should be worked" — a query a
> periodic job runs, not something a queue consumer subscribes to.
>
> **Deliberately stubbed, not the real capacity model.** Neither the
> `Operators` nor `Shifts` table exists yet — only designed on paper
> (`data-model.md`, `ddb-design.md`). Building those for real (event-sourced
> `Operator`, shift check-in/out, real concurrency tracking) is a separate,
> later, and substantially bigger doc. Everything capacity-related here is
> an explicit interface + a trivial v1 implementation, same "stub proves the
> shape" pattern as `OrderEvaluationRule`/`OrderPriorityAssigner`
> (`5-order-evaluation.md` §2/§4) — a real implementation swaps in later
> without this job's orchestration logic changing.
>
> `backend/`/`cdk/` are already unlocked (`CLAUDE.md` §5.1/§5.2) — this doc
> settles design questions before writing code, not a directory unlock.

---

## Decision Status

Negotiated **question by question**, same progressive style as
`5-order-evaluation.md`. Nothing below is decided beyond what's marked
Agreed.

| Topic | Status |
|---|---|
| [1. Job trigger, cadence & controller placement](#1-job-trigger-cadence--controller-placement) | **Agreed (2026-08-28)** |
| [2. Order selection query — fixing and using `gsi1-stage-sla`](#2-order-selection-query--fixing-and-using-gsi1-stage-sla) | **Agreed (2026-08-28)** |
| [3. Pool derivation & the "cannot schedule" Case path](#3-pool-derivation--the-cannot-schedule-case-path) | **Agreed (2026-08-28)** |
| [4. Capacity service — `CapacityAvailabilityProvider`](#4-capacity-service--capacityavailabilityprovider) | **Agreed (2026-08-28)** |
| [5. Timing model — two separate estimators](#5-timing-model--two-separate-estimators) | **Agreed (2026-08-28)** |
| [6. Operator assignment — stateless `OperatorDao` stub](#6-operator-assignment--stateless-operatordao-stub) | **Agreed (2026-08-28)** |
| [7. Dispatch loop, `OrderEvent`/state changes, per-order error handling](#7-dispatch-loop-orderevent-state-changes-per-order-error-handling) | **Agreed (2026-08-28)** |
| [8. Concurrency & idempotency](#8-concurrency--idempotency) | **Agreed (2026-08-28)** |
| [9. Observability & metrics](#9-observability--metrics) | **Agreed (2026-08-28)** |
| [10. Testing](#10-testing) | **Agreed (2026-08-28)** |

---

## 1. Job trigger, cadence & controller placement

**Agreed (2026-08-28):** mirrors `cdk/lambda/Nyc311PollerSchedule.ts` exactly
— the only other periodic-job precedent in this project.

- **`EventBridge Scheduler`**, `ScheduleExpression.rate(Duration.hours(1))`
  (the user's stated cadence — tighter than the poller's 6h, since dispatch
  backlog is far more time-sensitive than 311-record freshness).
- **Dead-letter queue** on the schedule's Lambda target, plus a
  `CloudWatch Alarm` on consecutive invocation failures (same
  `treatMissingData: NOT_BREACHING`, `GREATER_THAN_OR_EQUAL_TO_THRESHOLD`
  shape as the poller's — one bad hour is a non-event, several in a row
  isn't).
- **Trigger payload**: `backend/models/orderSchedulingTrigger.ts`,
  `z.record(z.string(), z.unknown())` — same empty-object-but-still-validated
  shape as `IngestionPollTriggerSchema`, not reused directly since it's a
  different trigger for a different Lambda (matches the project's "one
  model file per shared-but-not-a-domain-entity type" convention,
  `CLAUDE.md` §5.2).
- **Controller**: `backend/controller/order-processing/scheduleOrdersController.ts`
  — this directory already owns "what happens to an Order after creation";
  dispatch is squarely that. Parses the trigger via the schema above (first
  thing, per `CLAUDE.md` §5.2), logs the full trigger in and the run summary
  out, then calls `orderSchedulingService.scheduleOrders()`.
- **Lambda**: `cdk/lambda/Nyc311OrderSchedulingLambda.ts`, `cdk/lambda/Nyc311OrderSchedulingSchedule.ts`
  — physical names `Nyc311OrderScheduling-${suffix}` (`CLAUDE.md` §5.3).
  Added to the Lambda Health monitoring tile
  (`MONITORED_LAMBDA_ORDER_SCHEDULING`).

---

## 2. Order selection query — fixing and using `gsi1-stage-sla`

**Agreed (2026-08-28).**

**Bug found while researching this doc**: `gsi1-stage-sla` is already
defined in `cdk/data/OrdersTable.ts` (`gsi1pk`/`gsi1sk`), and
`ddb-design.md` documents its intended access pattern as exactly this
job's query — but **it's never actually populated**. `OrderSchema` has no
`gsi1pk`/`gsi1sk` fields, and neither `OrderDao.createOrder` nor
`acceptOrder` sets them. A `Query gsi1pk = "STAGE#SCHEDULE"` today returns
nothing. This doc closes that gap rather than routing around it with a
`listOrders`-style `Scan` (which exists and works, but isn't sorted by
`sla_deadline` and is the more expensive path `ddb-design.md` built this
GSI specifically to avoid).

**Fix, following `RequestDao`'s existing `additionalAttributes` pattern**
(`Dao.putItem`'s `additionalAttributes` keeps GSI key attributes out of the
domain schema — "so `RequestSchema` stays the pure domain shape").
`EventSourcedDao.appendEvent` has no equivalent today (it writes
`{...newProjection}` directly) — add one:

```ts
// backend/dao/dao.ts — EventSourcedDao.appendEvent, new 4th parameter
protected async appendEvent(
  partitionKeyValue: string,
  buildEvent: (nextSequence: number) => TEvent,
  foldProjection: (previous: TProjection | null, event: TEvent) => TProjection,
  additionalProjectionAttributes?: (projection: TProjection) => Record<string, unknown>
): Promise<TProjection>
```

Merged into the projection `Put`'s `Item` only (never the event item —
`ddb-design.md`: "Sparse — set only on projection items, never on event
items"). Optional parameter, so every existing `appendEvent` call
(`createOrder`, `rejectOrder`, `recordCaseCreated`, ...) is unaffected.

**`OrderDao.acceptOrder` is updated** (already-shipped code, retrofitted)
to pass `(p) => ({ gsi1pk: \`STAGE#${p.current_stage}\`, gsi1sk: p.sla_deadline })`
— this is the first point `sla_deadline` becomes non-null, so it's the
first point the sparse index can include the item at all (DynamoDB
requires *both* `gsi1pk` and `gsi1sk` present for a sparse-index item to
appear — `createOrder`, where `sla_deadline` is still `null`, correctly
stays excluded).

**New `OrderDao` read method** for this job:

```ts
async listOrdersWaitingForSchedule(options: { limit: number; cursor?: string | null }): Promise<OrderListResult>
```

`Query` on `gsi1-stage-sla`, `gsi1pk = "STAGE#SCHEDULE"`,
`ScanIndexForward: true` (ascending `sla_deadline` — oldest-deadline-first,
`ddb-design.md`'s stated ordering). Same opaque-cursor pagination shape
`listOrders`/`listOrderEvents` already use.

**Per-run cap**: `MAX_ORDERS_PER_RUN = 200`, paginating via the cursor above
until either the cap is hit or the query is exhausted — a defensive bound
on Lambda runtime, not a real volume constraint at this project's scale
(same reasoning as the poller's own per-run record cap in
`1-data-ingestion.md`). Anything left over waits for next hour's run, still
at the front of the queue next time since it's still sorted by
`sla_deadline`.

---

## 3. Pool derivation & the "cannot schedule" Case path

**Agreed (2026-08-28).** A pool is `agency` (from `Request`) + `borough`
(from `Location`), matching `capacity-model.md` §1 and the exact key shape
`ddb-design.md`'s `Shifts` table example already uses:
`` `${agency}#${borough}` `` (e.g. `"DSNY#QUEENS"`). Neither field is
denormalized onto `Order`, so deriving it means one `RequestDao.getRequestById`
and one `LocationDao.getLocation` per Order in the run (both DAOs already
exist).

**Both fields are nullable today** (`Request.agency`, `Location.borough`).
When either is null, the Order can never be routed to a pool — **the job
creates a Case**, reusing the existing stubs exactly the way
`orderEvaluationService.ts`'s `CASE` outcome does:

```ts
await createCase({
  case_type: "WORKFLOW_EXECUTION_FAILURE", // closest existing fit — same
                                            // placeholder precedent as
                                            // 5-order-evaluation.md §5
  request_id: order.request_id,
  order_id: order.order_id,
  reason: "Cannot derive a capacity pool — missing agency or borough",
});
await orderDao.recordCaseCreated(order.order_id, "Cannot derive a capacity pool — missing agency or borough");
```

Same as `5-order-evaluation.md` §4's `CASE` outcome: **`Order.case_id` is
not stamped** (no real Case persistence to reference), and
`status`/`current_stage` don't change — the Order stays in `SCHEDULE`.

**Known, accepted gap, named explicitly (same pattern as the DLQ-Case gap
in `5-order-evaluation.md` §6):** because the Order stays in `SCHEDULE`
with nothing distinguishing "already Cased" from "not yet looked at,"
**every hourly run will re-derive the same missing pool and create another
Case** for that Order, indefinitely, until either its `Request`/`Location`
data is fixed or real Case persistence exists to de-duplicate against an
already-open Case. Today `createCase` only logs, so the actual cost is
repeated log lines, not paging noise — acceptable for now, logged in
`99-things-to-come-back-to.md`. The natural fix (skip if `case_id` is
already set) falls out for free once Case persistence is real.

This path is **not** the same as ordinary capacity exhaustion (§7) — a
pool that's simply full this run is normal backlog, not a Case. Queue-wait
SLA breach (`capacity-model.md` §6, its own future `capacity-escalation`
Case) is **not** implemented by this doc either — this doc only builds §1–§4's
dispatch mechanics, not §6's breach detection.

---

## 4. Capacity service — `CapacityAvailabilityProvider`

**Agreed (2026-08-28).** Interface matches `capacity-model.md` §4.2's
description exactly:

```ts
// backend/service/scheduling/capacityAvailabilityService.ts
export interface CapacityAvailabilityProvider {
  getAvailableUnits(pool: string): Promise<number>;
}
```

**v1 (mock) implementation**: a single fixed constant, returned for *any*
pool string — no per-pool differentiation, no inspection of `pool` at all,
same "stub proves the shape" restraint as `RandomOrderEvaluationRule`:

```ts
const MOCK_POOL_CAPACITY_UNITS = 5;

export const mockCapacityAvailabilityProvider: CapacityAvailabilityProvider = {
  async getAvailableUnits(_pool: string): Promise<number> {
    return MOCK_POOL_CAPACITY_UNITS;
  },
};
```

**What "available" means for v1 — a per-run budget, not live concurrency.**
The dispatch loop (§7) calls `getAvailableUnits(pool)` once per pool
*per run* (not per Order), then decrements an in-memory remaining-budget
counter for that pool as it successfully schedules Orders into it within
that same run. This is deliberately **not** true point-in-time concurrent
capacity (`unit_count` minus Orders currently in-flight) — that requires
knowing which Orders are still active per pool, which requires either
denormalizing `pool` onto `Order` or real `Operator`/`Shift` check-in
tracking, neither of which exists. Named as a real, known limitation: a
future real implementation queries actual in-flight state; this job's
orchestration logic (§7) doesn't change when that swap happens, only which
provider it's constructed with.

Per-pool admin-configurable unit counts (`capacity-model.md` §6) are future
work — the mock intentionally doesn't even take a config lookup, matching
the "no inspection at all" restraint the other v1 mocks in this project use.

---

## 5. Timing model — two separate estimators

**Agreed (2026-08-28), revised from a static total-duration stub.** Kept as
**two** separate pluggable interfaces, matching `capacity-model.md` §3's
own split — deliberately not one flat "duration" stub, so transit and
processing can each be built out independently later without the other
changing:

```ts
// backend/service/scheduling/transitTimeService.ts
export interface TransitTimeEstimator {
  /** Minutes to reach the job from the pool's depot. */
  estimateMinutes(order: Order, location: Location): Promise<number>;
}

// backend/service/scheduling/processingTimeService.ts
export interface ProcessingTimeEstimator {
  /** Minutes of on-site work once arrived. */
  estimateMinutes(order: Order, request: Request): Promise<number>;
}
```

**v1 (mock) implementations — fixed constants, no inspection of their
arguments**, same restraint as §4's capacity mock:

```ts
const MOCK_TRANSIT_MINUTES = 20;
const MOCK_PROCESSING_MINUTES = 30;
```

`capacity-model.md` §3's real v1 (Haversine distance, per-`complaint_type`
duration lookup) is **not** built here — these constants are a placeholder
one level simpler than that already-specced v1, deferred to whichever doc
first needs a real duration. The interfaces are shaped so that doc is a
drop-in swap, not a redesign.

**Scheduled window**: `scheduled_start = <job run time>`,
`scheduled_end = scheduled_start + transitMinutes + processingMinutes`. No
real slot-packing against a unit's own timeline (multiple Orders dispatched
in the same run all get `scheduled_start = now` independently) — an
accepted simplification, since there's no real per-unit calendar to pack
against yet either. `capacity-model.md` §8's "computes the next available
slot" is approximated as "now plus this Order's own estimated duration,"
not a true queueing simulation.

---

## 6. Operator assignment — stateless `OperatorDao` stub

**Agreed (2026-08-28).** `data-model.md`'s real `Operator` is a full
event-sourced entity (`function_type`, `status`, `current_shift_id`,
`current_activity`, ...) — building that for real is out of scope (intro).
What this doc needs is just something to put in `Order.assigned_operator_id`
so that field isn't left null forever.

```ts
// backend/models/operator.ts
export const OperatorSchema = z.object({
  operator_id: z.string().min(1),
});
export type Operator = z.infer<typeof OperatorSchema>;
```

Deliberately **not** `data-model.md`'s full `Operator` projection — this
type only carries what the mock scheduler needs today.

```ts
// backend/dao/operator/operatorDao.ts
export class OperatorDao {
  async getOperator(): Promise<Operator> {
    return { operator_id: randomUUID() };
  }
}
```

**Fully stateless — no `Operators` table, no DynamoDB call at all.** A
fresh random UUID every call, never persisted, never look-up-able again.
This is a deliberate scope line: it keeps the DAO/service *shape* real
(`getOperatorDao()` lazy-construction helper, same convention as every
other DAO per `CLAUDE.md` §5.2, so a real implementation swaps in without
callers changing) without pulling forward the real `Operators` aggregate
build. No `sqs`/`dynamodb` IAM grants are needed for this Lambda on account
of operator assignment — flagged explicitly in §1's Lambda IAM scoping so
it isn't assumed later.

---

## 7. Dispatch loop, `OrderEvent`/state changes, per-order error handling

**Agreed (2026-08-28).** `orderSchedulingService.scheduleOrders()`
orchestrates, per run:

1. Page through `listOrdersWaitingForSchedule` (§2) — priority order,
   oldest-`sla_deadline`-first, up to `MAX_ORDERS_PER_RUN`.
2. For each Order, in order:
   a. Fetch its `Request` and `Location` (§3). Missing `agency`/`borough`
      → create a Case (§3), continue to the next Order.
   b. Derive `pool`. Look up (or reuse, if already looked up this run) the
      pool's remaining budget via `CapacityAvailabilityProvider` (§4).
      `remaining <= 0` → **skip, no event, no Case** — log and continue
      (normal backlog; picked up again next run, still at the front of the
      queue).
   c. Otherwise: compute `scheduled_start`/`scheduled_end` (§5), assign an
      operator (§6), then a **single** `ORDER_SCHEDULED` event via a new
      `OrderDao.scheduleOrder(orderId, input)`.
   d. Decrement that pool's in-memory remaining budget by 1.

**Single merged event, not `ORDER_SCHEDULED` + `ORDER_ASSIGNED`** — same
one-atomic-write reasoning `5-order-evaluation.md` §4 already used to merge
`PriorityAssigned` into `ORDER_ACCEPTED` (`EventSourcedDao.appendEvent`
does one event + one projection fold per call; two sequential appends for
one logical transition risks a crash leaving an Order scheduled-but-
unassigned). `ORDER_SCHEDULED`'s payload carries `scheduled_start`,
`scheduled_end`, *and* `operator_id`. `ORDER_ASSIGNED` (already in
`ORDER_EVENT_TYPES`, still unused after this doc) stays reserved for a
genuine future *reassignment* — `data-model.md`'s "can recur later as a
reassignment" case, which this doc doesn't build.

```ts
// backend/dao/order/orderDao.ts — new method
async scheduleOrder(orderId: string, input: {
  scheduledStart: string; scheduledEnd: string; operatorId: string;
}): Promise<Order> {
  return this.appendEvent(
    orderId,
    (nextSequence) => ({
      order_id: orderId, sequence_number: nextSequence,
      event_type: "ORDER_SCHEDULED", stage: "SCHEDULE",
      payload: { scheduled_start: input.scheduledStart, scheduled_end: input.scheduledEnd, operator_id: input.operatorId },
      occurred_at: new Date().toISOString(), actor: "SYSTEM",
    }),
    (previous, event) => {
      const base = this.requirePreviousProjection(orderId, previous);
      return {
        ...base,
        current_stage: "EXECUTE",
        scheduled_start: input.scheduledStart,
        scheduled_end: input.scheduledEnd,
        assigned_operator_id: input.operatorId,
        updated_at: event.occurred_at,
        last_event_sequence: event.sequence_number,
      };
    },
    (p) => ({ gsi1pk: `STAGE#${p.current_stage}`, gsi1sk: p.sla_deadline })
  );
}
```

`status` stays `ACTIVE` — no new status value needed, same "`current_stage`
already carries the fine-grained where" reasoning `5-order-evaluation.md`
§4 already established.

**Per-order error isolation**: each Order's a/b/c/d sequence above is
wrapped in its own `try`/`catch` inside the loop. A thrown error (a lost
optimistic-lock race → `TerminalError`, a malformed downstream record →
`ValidationError`) is logged with the `order_id` and the loop moves on —
one bad Order never aborts the whole run. Matches `CLAUDE.md` §5.2's
per-item-outcome logging rule (not just a final summary count).

---

## 8. Concurrency & idempotency

**Agreed (2026-08-28).**

**Double-scheduling one Order** is already prevented at the DAO level —
`appendEvent`'s existing `last_event_sequence` condition-check means a
second concurrent `scheduleOrder` call for the same Order throws
`TerminalError` (caught per §7's per-order isolation), and that Order no
longer even matches `gsi1pk = "STAGE#SCHEDULE"` after the first succeeds
(its `current_stage` moved to `EXECUTE`), so a subsequent run's query
wouldn't re-select it anyway.

**The in-memory per-run capacity budget (§4) is not safe across concurrent
invocations** — two overlapping runs would each independently believe a
pool has its full `MOCK_POOL_CAPACITY_UNITS` available and could jointly
over-schedule it. Rather than build real distributed locking for a mock
budget, **the Lambda is configured with `reservedConcurrentExecutions: 1`**
— only one invocation of this function ever runs at a time; a second
`EventBridge Scheduler` firing while the first is still in flight throttles
and lands in the DLQ (§1) instead of running concurrently. At this
project's real volume (job runtime well under an hour), this is a clean,
cheap way to remove the race entirely rather than a workaround — revisit
only if real concurrency tracking (§4) makes the in-memory budget go away.

---

## 9. Observability & metrics

**Agreed (2026-08-28):** structured logs only, same restraint
`5-order-evaluation.md` §7 already chose, for the same reasons (no live
counter/rate tile needed yet, no `MetricFilter` budget spent — 7 of 10
project-wide remain).

- **Controller** logs the full trigger payload in, and a run summary out
  (`orders_considered`, `orders_scheduled`, `orders_skipped_no_capacity`,
  `orders_cased_unroutable`, `orders_failed`).
- **Service** logs one structured line per Order per §7's per-item rule:
  `OrderScheduleAttemptStarted`, then one of
  `OrderScheduled`/`OrderScheduleSkippedNoCapacity`/`OrderScheduleCaseCreated`/
  `OrderScheduleFailed`.
- **CloudWatch Alarm** on consecutive Lambda failures (§1) — built as its
  own self-contained construct, `cdk/lambda/Nyc311OrderSchedulingSchedule.ts`
  (DLQ + failure topic + alarm together), mirroring `Nyc311PollerSchedule`'s
  shape exactly rather than folding into `Nyc311OrderPipelineAlarms.ts`
  (that construct is scoped to the evaluation pipeline's own fan-out/queue
  resources, not a general-purpose shared alarm holder).

---

## 10. Testing

**Agreed (2026-08-28).** Same four-tier model as every other doc
(`testing-framework.md`), nothing new invented:

- **Unit (Vitest, 90% per-file):** `EventSourcedDao.appendEvent`'s new
  optional 4th parameter (existing calls unaffected, new attribute path
  covered); `OrderDao.acceptOrder`'s retrofitted `gsi1pk`/`gsi1sk`;
  `OrderDao.listOrdersWaitingForSchedule` (pagination, cap); `OrderDao.scheduleOrder`
  (event/fold/GSI-attribute correctness); `CapacityAvailabilityProvider`
  mock; `TransitTimeEstimator`/`ProcessingTimeEstimator` mocks;
  `OperatorDao.getOperator` (stateless, unique per call); the dispatch
  loop's branches (scheduled, skipped-no-capacity, Cased-unroutable,
  per-order error isolation, per-pool budget decremented correctly across
  multiple Orders in one run); the trigger schema; the controller.
- **CDK assertions:** `Nyc311OrderSchedulingLambda` (IAM — Orders
  read/write, Requests read, Locations read, *no* Operators/Cases
  grants — asserted explicitly per §6/§9's flag), `reservedConcurrentExecutions: 1`
  (§8, asserted directly — a silent removal would reopen the concurrency
  race with no test failure otherwise), the `EventBridge Scheduler`
  `rate(1 hour)` expression, the DLQ, the failure alarm.
- **No new real-integration route.** Same carve-out as `5-order-evaluation.md`
  §8 — no API Gateway route added. Worth a `test-scripts/`-style manual
  sanity script (write a Schedule-stage Order directly, invoke the Lambda,
  poll for the resulting `ORDER_SCHEDULED` event) for on-demand checking
  against a real `Nyc311-Test` deploy, not a pipeline-blocking gate.

---

## Build Checklist

Code built and locally verified 2026-08-28; live `Nyc311-Test` deploy/verification below still pending.

- [x] `backend/dao/dao.ts` — `EventSourcedDao.appendEvent`'s new optional
      `additionalProjectionAttributes` parameter (§2).
- [x] `backend/dao/order/orderDao.ts` — retrofit `acceptOrder` to set
      `gsi1pk`/`gsi1sk` (§2); add `listOrdersWaitingForSchedule` (§2) and
      `scheduleOrder` (§7).
- [x] `backend/dao/location/locationDao.ts` — added `getLocation` (§3, not
      originally called out explicitly but needed for pool derivation).
- [x] `backend/models/operator.ts` — minimal `Operator` (§6).
- [x] `backend/models/orderSchedulingTrigger.ts` — trigger schema (§1).
- [x] `backend/dao/operator/operatorDao.ts` — stateless `getOperator` (§6).
- [x] `backend/service/scheduling/capacityAvailabilityService.ts` —
      `CapacityAvailabilityProvider` + mock (§4).
- [x] `backend/service/scheduling/transitTimeService.ts`,
      `processingTimeService.ts` — two estimators + mocks (§5).
- [x] `backend/service/scheduling/orderSchedulingService.ts` —
      `scheduleOrders()` orchestration, pool derivation, the dispatch loop,
      Case-on-unroutable (§3/§7).
- [x] `backend/controller/order-processing/scheduleOrdersController.ts` (§1).
- [x] `cdk/lambda/Nyc311OrderSchedulingLambda.ts` (`reservedConcurrentExecutions: 1`,
      §8) and `Nyc311OrderSchedulingSchedule.ts` (`rate(1 hour)`, DLQ, alarm, §1).
- [x] Wired into `cdk/stack/Nyc311Stack.ts`, plus the Lambda Health tile
      (`MONITORED_LAMBDA_ORDER_SCHEDULING`, both `cdk/` and `backend/`
      sides).
- [x] Unit tests + CDK assertion tests, 90%+ per-file (100% achieved on
      every touched file), `backend` and `cdk` both green (§10).
- [x] Log the repeated-Case-on-unroutable gap (§3) in
      `99-things-to-come-back-to.md` —
      [#11](https://github.com/seththeeke/nyc-311/issues/11).
- [ ] Deployed to `Nyc311-Test` via the pipeline (`DeployTest` succeeded)
      and verified live: manually invoke the Lambda, confirm at least one
      Order actually reaches `current_stage: "EXECUTE"` with a stamped
      `scheduled_start`/`scheduled_end`/`assigned_operator_id`.

---

*(All 10 topics decided and built. Live `Nyc311-Test` verification is the
last open checklist item.)*
