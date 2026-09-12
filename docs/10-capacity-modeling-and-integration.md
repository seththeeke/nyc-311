# Capacity Modeling & Integration — Design & Build Doc

> Legs 1-4 of the capacity-management effort (Leg 0, admin auth, is
> `9-admin-auth-integration.md` — shipped and verified live 2026-09-10).
> Replaces the hardcoded/mock capacity built in `6-order-scheduling.md` (`MOCK_POOL_CAPACITY_UNITS
> = 5`, a fresh random-UUID `OperatorDao.getOperator()` never persisted) with
> a real, admin-manageable `Operator` fleet, a real cost model, a real
> `Execute → Resolve` simulation, and on-demand test-data cleanup.
>
> **Deliberately simpler than `capacity-model.md`/`data-model.md`'s full
> design for v1**: no agency/borough pools, no `Shift` entity, no
> staffing/forecasting. One global fleet of fixed-cost `Operator`s. Pools
> and shifts remain the eventual real design (unchanged in those docs) —
> this doc amends `data-model.md` only to add the new `Operator`/`Order`
> event types the execution simulation needs, and drops `Operator.function_type`
> / `current_shift_id` from the v1 schema (re-added whenever pools/shifts
> get built for real).
>
> Negotiated **question by question**, same progressive style as
> `5-order-evaluation.md`/`6-order-scheduling.md`/`9-admin-auth-integration.md`.

---

## Decision Status

| Leg | Topic | Status |
|---|---|---|
| 1 | [1.1 `Operator` schema for v1](#11-operator-schema-for-v1) | **Agreed (2026-09-10)** |
| 1 | [1.2 Rate assignment](#12-rate-assignment) | **Agreed (2026-09-10)** |
| 1 | [1.3 Seeding](#13-seeding) | **Agreed (2026-09-10) — built and run in `Nyc311-Test`** |
| 1 | [1.4 GSIs](#14-gsis) | Built as proposed |
| 1 | [1.5 Real `CapacityAvailabilityProvider` & the deferred atomic claim](#15-real-capacityavailabilityprovider--the-deferred-atomic-claim) | **Agreed (2026-09-10) — deliberately NOT wired into scheduling yet, per explicit instruction** |
| 2 | [2.1 API surface](#21-api-surface) | Built as proposed |
| 2 | [2.2 Frontend surface — the Admin page](#22-frontend-surface--the-admin-page) | **Agreed (2026-09-10)** |
| 2 | [2.3 Cost architecture](#23-cost-architecture) | **Agreed (2026-09-10)** |
| 3 | [3.1 New `OrderEvent`/`OperatorEvent` types](#31-new-ordereventoperatorevent-types) | Proposed — flag if wrong |
| 3 | [3.2 Step Function shape](#32-step-function-shape) | **Agreed (2026-09-10)** |
| 3 | [3.3 Sim-time config — AppConfig](#33-sim-time-config--appconfig) | **Agreed (2026-09-10)** |
| 3 | [3.4 Failure injection at `EXECUTE`](#34-failure-injection-at-execute) | **Agreed (2026-09-10), deferred** |
| 4 | [4.1 Cleanup script scope](#41-cleanup-script-scope) | **Agreed (2026-09-10)** |

---

## Leg 1 — Operator entity & capacity model

### 1.1 `Operator` schema for v1

**Agreed.** Event-sourced, same source-of-truth/projection split as `Order`.
`function_type` and `current_shift_id` are **dropped** from the v1 schema
(no pools/shifts yet — re-added when those get built for real, not
carried now as unused placeholders).

**`Operator` (projection):**

| Field | Notes |
|---|---|
| `operator_id` | Identity (ULID). |
| `status` | `ACTIVE` \| `INACTIVE` — stored, driven by events (not purely derived), so GSI2 (§1.4) can filter on it directly. |
| `current_activity` | `IDLE` \| `TRANSIT` \| `WORKING`. No `OFF_SHIFT` — no shift concept in v1. Starts `IDLE`. |
| `removal_requested_at` | Nullable. Set when an admin removes a *busy* vehicle (§1.5-adjacent "queued removal" semantics, already agreed in conversation) — `current_activity` stays whatever it was; the vehicle simply isn't reassigned again and gets finalized (→ `INACTIVE`, `end_datetime` stamped) the moment its current execution resolves. Removing an already-`IDLE` vehicle finalizes immediately instead of setting this field. |
| `start_datetime` | Stamped at `OPERATOR_ADDED`. Never changes. |
| `end_datetime` | Nullable. Stamped once, at finalization. **A retired `operator_id` is never reactivated** — adding capacity later always creates a new `Operator`, per your explicit "always a new hire" instruction. |
| `rate_per_hour` | Stamped at `OPERATOR_ADDED` from the add-capacity request (§1.2). Immutable — historical cost stays stable even if the default rate changes later. |
| `last_event_sequence` | Standard replay/consistency field. |

**`OperatorEvent` types** (new — `data-model.md` currently only sketches
`CheckedIn`/`TransitStarted`/.../`CheckedOut`, all shift-scoped):

| `event_type` | Meaning |
|---|---|
| `OPERATOR_ADDED` | Fleet entry. Payload: `rate_per_hour`. |
| `OPERATOR_REMOVAL_REQUESTED` | Admin requested removal while busy — sets `removal_requested_at`, no other state change. |
| `OPERATOR_REMOVED` | Finalizes retirement — sets `status: INACTIVE`, `end_datetime`. Fired either immediately (removal requested while idle) or by the execution flow's resolve step (removal was queued while busy). |
| `TRANSIT_STARTED` | Payload: `order_id`. Sets `current_activity: TRANSIT`. |
| `WORK_STARTED` | Payload: `order_id`. Sets `current_activity: WORKING`. |
| `WORK_COMPLETED` | Payload: `order_id`. Sets `current_activity: IDLE` (or triggers `OPERATOR_REMOVED` instead, if `removal_requested_at` was set). |

These exist so `Operator` stays properly event-sourced (every state
transition goes through the same append+fold pattern as `Order`/`Case`) —
this is **not** a duplicate narrative of "what happened to the Order"; that
detail lives on `Order`'s own stream per §3.1. Both streams update at the
same logical moment, same one-atomic-write-per-transition reasoning
already used for `OrderScheduled`.

**Cost note**: because §1.5/the earlier cost-accrual decision is
*continuous* (`(end_datetime ?? now) - start_datetime) × rate_per_hour`,
regardless of activity), `TRANSIT_STARTED`/`WORK_STARTED`/`WORK_COMPLETED`
matter only for **availability** (driving `current_activity` for
scheduling), not for cost math. No per-segment cost attribution needed for
v1 — a real simplification versus `business-insights.md`'s full
transit-cost/labor-cost split, acceptable because pools/shifts (where that
split actually matters) aren't in scope here either.

### 1.2 Rate assignment

**Agreed.** Every `Operator` stores its own `rate_per_hour`, stamped at
`OPERATOR_ADDED`. The add-capacity request (§2.1) accepts an optional
override; omitted, it defaults to a fixed constant
(`DEFAULT_OPERATOR_RATE_PER_HOUR`, exact value TBD at build time — a
placeholder business input, same spirit as `MOCK_TRANSIT_MINUTES` etc.).
The 10 seeded vehicles (§1.3) all take the default, satisfying "10
vehicles of a fixed cost" today, while leaving room for a differently-priced
vehicle added later without a schema change.

### 1.3 Seeding

**Agreed, built.** No separate seeding code path — `test-scripts/7-seed-capacity.py`
signs in as the test-admin and calls the real `POST /capacity` idempotently
(tops up to a target fleet size, default 10, rather than always adding 10
more), proving the real write path works in the same step.

### 1.4 GSIs

**Built as proposed.**

**`gsi1-availability`** — `gsi1pk = "AVAILABLE"` (fixed constant),
`gsi1sk = start_datetime`. **Sparse**: only set while `status = ACTIVE`,
`current_activity = IDLE`, and `removal_requested_at` is null — the
moment any of those stop holding, the projection write omits
`gsi1pk`/`gsi1sk` (same sparse-index-as-queue pattern as `Orders`'
`gsi1-stage-sla`). This is what the real `CapacityAvailabilityProvider`
(§1.5) queries — `Query gsi1pk = "AVAILABLE"`, oldest-idle-first, so
assignment is fair rather than always picking the same vehicle.

**`gsi2-roster`** — `gsi2pk = "OPERATOR"` (fixed constant, set on every
`Operator` projection unconditionally — not sparse), `gsi2sk = status +
"#" + start_datetime`. Two access patterns off the same index:
- `Query gsi2pk = "OPERATOR"`, `gsi2sk` begins-with `"ACTIVE#"` — live
  fleet size/roster (§2.1's `GET /capacity`).
- `Query gsi2pk = "OPERATOR"`, unfiltered — every `Operator` ever, active
  or retired, for the warehouse cost job's fold (§2.3) to export via the
  existing DynamoDB-Streams-to-Firehose pipeline (no new export mechanism
  needed — `Operators` gets a stream exactly like `Orders`/`Requests`
  already do).

### 1.5 Real `CapacityAvailabilityProvider` & the deferred atomic claim

**Agreed.** Replaces the mock entirely — no more per-pool fictional
budget. `getAvailableUnits()` becomes a real `Query` on `gsi1-availability`
returning a live idle count; assignment claims a specific `operator_id`
from that same query's results.

**Atomic claim deferred, explicitly** (matches this project's own
precedent, `6-order-scheduling.md` §8): the scheduling job still runs
`rate(1 hour)` with sub-hour runtime, so overlapping invocations don't
occur in practice, and within one invocation the loop is single-threaded
— the only writer of idle→busy transitions is this job itself, so a plain
(non-conditional) `UpdateItem` per assignment is safe for now. Named here,
not silently accepted: **revisit if the scheduling cadence ever tightens**
below "one run reliably finishes before the next starts."

---

## Leg 2 — Capacity management API + frontend

### 2.1 API surface

**Built as proposed.** All three routes sit behind Leg 0's JWT authorizer (admin-only
— per §2.2, this whole surface lives under the new Admin page, not the
public Monitoring page):

| Route | Behavior |
|---|---|
| `POST /capacity` | Body: `{ rate_per_hour?: number }`. Emits `OPERATOR_ADDED`. Returns the new `Operator`. |
| `DELETE /capacity/{operator_id}` | Queues or finalizes removal per §1.1's semantics. Returns the updated `Operator`. |
| `GET /capacity` | Live stats (available count, active fleet size, current hourly burn rate = sum of active `rate_per_hour`) + the active roster list, via `gsi2-roster` (§1.4). |

**Future, not built now**: a separate **public** read endpoint (e.g.
surfacing "N operators currently executing" / order-state counts) is
anticipated for a future home-page map view you mentioned — deliberately
not designed here since that view doesn't exist yet, but this API surface
should not preclude adding a lightweight public summary route later
without reworking `GET /capacity` itself.

### 2.2 Frontend surface — the Admin page

**Agreed, built.** A new **Admin** page (`web-app/components/pages/AdminPage.tsx`,
route `/admin`), gated by Leg 0's `AdminRoute` guard, mirroring
`MonitoringPage.tsx`'s tile-grid layout exactly. **Capacity is its first
tile** (`/admin/capacity`, `CapacityManagementPage.tsx`) — everything
capacity-related (live stats, roster table, add control, per-row remove)
lives behind that page, fully admin-gated, separate from the public,
always-public `MonitoringPage`.

- **Add**: a control defaulting to the standard rate, with an optional
  override input.
- **Roster table**: every active `Operator` (id, rate, `current_activity`,
  `start_datetime`), each row with a **Remove** button.
- Removed/retired vehicles drop off this table (they're `INACTIVE`) but
  remain queryable in history (§1.4's unfiltered `gsi2-roster` query) for
  the cost job.

### 2.3 Cost architecture

**Agreed.** Split by freshness need, addressing the ~1000-vehicle scale
question directly:

- **Live fleet stats** (available/fleet-size/burn-rate) — a direct
  `gsi2-roster` query against **current projections only**, bounded by
  fleet size (not full event history). At 1000 vehicles this is one
  sub-second, cheap `Query`. No scale concern. **Built** —
  `capacityService.getCapacityStatus`.
- **All-time accumulated cost** — **not built in this pass**, still future
  work. Computed by a **new job in the existing
  data-warehouse pipeline** (`7-data-warehousing.md`'s job-runner: `Operators`
  gets a DynamoDB Stream → Firehose → S3/Parquet → Athena, same as
  `Orders`/`Requests` already do), not folded live on every page load.
  This is the workload that genuinely doesn't scale as a live computation
  (unbounded event history over the project's lifetime), and it's exactly
  the kind of aggregate `business-insights.md`/`7-data-warehousing.md`
  already built this infrastructure for. Surfaced via the existing `GET
  /data/{schema,jobs,rollups}` / `/reports` read paths, linked from (or
  embedded as a stat on) the Capacity tile.

---

## Leg 3 — Order execution simulation

### 3.1 New `OrderEvent`/`OperatorEvent` types

**Proposed.** Per the earlier "amend `data-model.md`, granular progression
lives on `Order`'s own stream" decision. New `OrderEvent` types (added to
`ORDER_EVENT_TYPES` in `backend/models/order.ts`):

| `event_type` | `stage` | Meaning |
|---|---|---|
| `ORDER_DISPATCHED` | `EXECUTE` | Assigned vehicle begins transit. Mirrors `OperatorEvent.TRANSIT_STARTED` on the Operator side. |
| `ORDER_ARRIVED` | `EXECUTE` | Vehicle reached the job location. Mirrors `WORK_STARTED`. |
| `ORDER_PROCESSING` | `EXECUTE` | On-site work underway (distinct from `ORDER_ARRIVED` so the frontend can show a "processing" state, not just "arrived"). |
| `ORDER_RESOLVED` | `RESOLVE` | **Already exists** in `ORDER_EVENT_TYPES` — terminal, finally emitted for real. Mirrors `WORK_COMPLETED`. |

Each Step Function Task (§3.2) fires the matching pair — one `OrderEvent`
(narrative, frontend-visible) + one `OperatorEvent` (state-sourcing,
drives `current_activity`) — in the same controller call, same
one-atomic-transaction-per-transition spirit as everywhere else in this
codebase (two separate DAOs/tables here, so two writes, not one
`TransactWriteItems` — flagged as an accepted small window rather than a
new cross-table transaction mechanism, matching this project's general
tolerance for "per-order/operator error isolation" over perfect atomicity
across independent aggregates).

### 3.2 Step Function shape

**Agreed.** One **phase-routed Lambda**
(`Nyc311OrderExecutionLambda`, `{phase: DISPATCH | ARRIVE | PROCESS |
RESOLVE}`), matching `Nyc311WarehouseRebuildWorker`'s existing precedent —
the one other state-machine pattern in this codebase — rather than four
separate controller Lambdas.

**State machine** (`cdk/step-function/Nyc311OrderExecutionStateMachine.ts`),
one execution **per Order**, started by `orderSchedulingService.scheduleOrder`
right after it assigns an `operator_id` (§1.5):

```
Dispatch (Lambda) → Wait(transit minutes, scaled §3.3) → Arrive (Lambda)
  → Wait(processing minutes, scaled §3.3) → Process/Resolve (Lambda)
```

`Dispatch` fires `ORDER_DISPATCHED`/`TRANSIT_STARTED`. `Arrive` fires
`ORDER_ARRIVED`/`WORK_STARTED` and — separately, since "processing" is its
own visible state per §3.1 — also `ORDER_PROCESSING` (no separate Wait
between arrival and processing-start; processing begins immediately on
arrival, matching the existing estimator's "transit + processing" model
with no idle gap modeled). `Process/Resolve` fires `ORDER_RESOLVED`/`WORK_COMPLETED`,
and finalizes any queued removal (§1.1) if `removal_requested_at` was set.

Per-order error isolation via the state machine's own `Catch` (routes to
whatever `Order`/`Case` failure path §3.4 eventually defines — deferred
for now, so a `Catch` in this leg just logs and fails the execution,
leaving the Order stuck at `EXECUTE` — named as an accepted gap alongside
§3.4).

### 3.3 Sim-time config — AppConfig

**Agreed.** AWS AppConfig, one configuration profile with a
`SIMULATION_TIME_SCALE` parameter, different deployed values per
environment — `100` for `Nyc311-Test` (100x compressed: a 20-minute
transit estimate becomes a 12-second `Wait`), `1` for `Nyc311-Prod` (real
time). The `Dispatch` phase reads AppConfig (Lambda AppConfig extension/
cached fetch) once per execution and computes the scaled Wait durations
before entering the state machine's `Wait` states.

Chosen over a checked-in per-environment file specifically because it's
runtime-changeable without a redeploy — matches "easily changed in the
future" — and is a real building block toward the "more complex algorithm"
you flagged as the eventual direction, without building that algorithm
now.

### 3.4 Failure injection at `EXECUTE`

**Agreed, deferred.** This leg ships the happy-path simulation only. What
a failed execution does to the assigned vehicle/Order (stuck busy? Case
created? vehicle force-returned to the pool?) is real design work on its
own — logged as a named follow-up in `99-things-to-come-back-to.md` once
this leg ships, not silently skipped.

---

## Leg 4 — Test DB cleanup script

### 4.1 Cleanup script scope

**Agreed.** `test-scripts/9-reset-test-data.py` (matching the existing
numbered-script convention), `--profile nyc311`, hardcoded/guarded to
`Nyc311-Test` only (no `--env` flag that could ever point at Prod — the
script simply doesn't accept one). Wipes `Requests-Test`, `Orders-Test`,
`Locations-Test`, `Operators-Test`, and resets the `CURSOR#nyc_311`
sentinel item so the poller re-ingests from scratch. Subject to `CLAUDE.md`
§3's Deploy Safety Gate — explicit confirmation immediately before every
run, same as any other mutating AWS call.

---

## Build Checklist

**Legs 1-2 built and locally verified 2026-09-12** (build/lint/test/coverage
green across `backend`/`cdk`/`web-app`, 90%+ per file); Legs 3-4 not yet
started. Per explicit instruction, capacity is **not wired into scheduling**
— `orderSchedulingService.ts` still uses the old `MockOperatorAssignmentDao`
stub (renamed from `OperatorDao`/`dao/operator/operatorDao.ts`, which that
name now belongs to for real) and the mock `CapacityAvailabilityProvider`,
unchanged.

**Leg 1 — Operator entity & capacity model**
- [x] `backend/models/operator.ts` — real `Operator`/`OperatorEvent` (replacing the old `{operator_id}`-only stub schema).
- [x] `backend/dao/operator/operatorDao.ts` — real event-sourced DAO (`addOperator`, `getOperator`, `queueRemoval`, `finalizeRemoval`, `listActiveRoster`).
- [x] `backend/dao/scheduling/mockOperatorAssignmentDao.ts` — the old scheduling stub, moved here and renamed to resolve the naming collision; `orderSchedulingService.ts` updated to match, behavior unchanged.
- [x] `backend/models/errors.ts` — added `NotFoundError` (a real code path needed it — removing a nonexistent Operator).
- [x] `cdk/data/OperatorsTable.ts` — `gsi1-availability` (sparse) + `gsi2-roster`, no stream yet (§2.3's warehouse job is future work).
- [x] `test-scripts/7-seed-capacity.py`.
- [ ] §1.5's real `CapacityAvailabilityProvider` swap-in — deliberately deferred.

**Leg 2 — Capacity management API + frontend**
- [x] `backend/models/capacityRequest.ts`, `capacityStatus.ts`.
- [x] `backend/service/capacity/capacityService.ts` — `addCapacity`, `removeCapacity`, `getCapacityStatus`.
- [x] `backend/controller/web-api/{add,remove,get}CapacityController.ts` — all admin-authorized via `requireAdminUser`.
- [x] `cdk/lambda/Nyc311{Add,Remove,Get}CapacityApiLambda.ts` — least-privilege grants per controller's actual DAO calls.
- [x] `cdk/api/Nyc311Api.ts` — `POST/DELETE/GET /capacity`, all behind the admin JWT authorizer; CORS widened to allow `POST`/`DELETE`.
- [x] `web-app/src/models/operator.ts`, `services/capacityService.ts` (real + mock, first mutating mock service in this codebase), `test-data/operators.ts` (10 baked Operators).
- [x] `web-app/src/hooks/useCapacity.ts`.
- [x] `web-app/src/components/pages/AdminPage.tsx` — replaced the Leg 0 placeholder with the real tile-grid page (`CapacityIcon` added to the shared icon set).
- [x] `web-app/src/components/capacity/{CapacityStatsPanel,AddCapacityForm,CapacityRosterTable}.tsx` + `pages/CapacityManagementPage.tsx`, routed at `/admin/capacity`.
- [x] `test-scripts/8-capacity-crud-test.py` — on-demand live CRUD verification (add → read → remove → read → 400/404 checks), deliberately **not** added to the pipeline's automatic integration gate (would mutate real capacity rows on every deploy otherwise).
- [x] Unit tests, 90%+ per file, `backend`/`cdk`/`web-app` all green. Manually verified in the browser (mock mode): add/remove both work end-to-end.
- [ ] §2.3's all-time-cost warehouse job — not built, future work.
- [x] Deployed to `Nyc311-Test`, verified live via `test-scripts/7-seed-capacity.py` (seeded fleet to 10, $450/hr) + `8-capacity-crud-test.py` (401/create/read/remove/read/400/404 all passed, net fleet-size change zero) — 2026-09-12.

**Leg 3 — Order execution simulation**: not started.

**Leg 4 — Test DB cleanup script**: not started — `test-scripts/9-reset-test-data.py`.
