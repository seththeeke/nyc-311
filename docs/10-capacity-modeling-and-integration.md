# Capacity Modeling & Integration — Design & Build Doc

> Legs 1-6 of the capacity-management effort (Leg 0, admin auth, is
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
| 3 | [3.5 Dropping capacity pools from scheduling](#35-dropping-capacity-pools-from-scheduling) | **Agreed (2026-09-12)** |
| 3 | [3.6 Resolving the idle→busy claim timing](#36-resolving-the-idlebusy-claim-timing) | **Agreed (2026-09-12)** |
| 3 | [3.7 GPS pings on the `OperatorEvent` stream](#37-gps-pings-on-the-operatorevent-stream) | **Agreed (2026-09-12)** |
| 3 | [3.8 Pre-scheduling hook — leading `Wait`](#38-pre-scheduling-hook--leading-wait) | **Agreed (2026-09-12)** |
| 4 | [4.1 Cleanup script scope](#41-cleanup-script-scope) | **Agreed (2026-09-10)** |
| 5 | [5.1 Admin Scheduling tile](#51-admin-scheduling-tile) | **Agreed (2026-09-12)** |
| 6 | [6.1 Home-page fleet map + public GPS read path](#61-home-page-fleet-map--public-gps-read-path) | **Agreed (2026-09-12)** |

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
| `name` | Free-text, admin-supplied at `OPERATOR_ADDED`, **not unique** — the only way to identify an Operator past its id. Added 2026-09-12. |
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
| `OPERATOR_ADDED` | Fleet entry. Payload: `name`, `rate_per_hour`. |
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
| `POST /capacity` | Body: `{ name: string, rate_per_hour?: number }`. Emits `OPERATOR_ADDED`. Returns the new `Operator`. |
| `DELETE /capacity/{operator_id}` | Queues or finalizes removal per §1.1's semantics. Returns the updated `Operator`. |
| `GET /capacity` | Live stats (available count, active fleet size, current hourly burn rate = sum of active `rate_per_hour`) + the active roster list, via `gsi2-roster` (§1.4). |

**Built (2026-09-12, Leg 6)**: the public read endpoint anticipated here —
`GET /fleet/locations` — see §6.1.

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

### 3.5 Dropping capacity pools from scheduling

**Agreed.** `orderSchedulingService.ts` (`6-order-scheduling.md` §7) still
gates dispatch on an `(agency, borough)` pool derived from
`Request.agency`/`Location.borough`, with a per-pool unit budget from
`CapacityAvailabilityProvider` — but the real `Operator` (Leg 1) has no
pool/agency/borough field at all; it's one flat, global fleet. Per
explicit instruction: **drop pools from scheduling entirely**, superseding
`6-order-scheduling.md` §7's pool-budget design (not `capacity-model.md`
itself, which remains the eventual real design if pools ever come back).

- `dispatchOneOrder`'s `derivePool`/`poolBudgets` and the
  "missing agency/borough → unroutable Case" branch are **removed**. A
  missing/invalid Location no longer creates a Case on the scheduling
  path — Location resolution failures are Leg 3-ingestion's problem
  (`3-order-ingestion.md`), not scheduling's.
- Capacity becomes one global check per Order: is there an idle
  `Operator` at all? First Order in the queue (oldest `sla_deadline`
  first, unchanged) that finds one gets it; once the fleet is exhausted,
  every remaining Order in the run is `SKIPPED_NO_CAPACITY` (no per-pool
  bookkeeping needed — one counter, not a `Map`).
- `mockCapacityAvailabilityProvider`/`MOCK_POOL_CAPACITY_UNITS` and
  `MockOperatorAssignmentDao` are deleted — replaced by real
  `OperatorDao` methods (§3.6).

### 3.6 Resolving the idle→busy claim timing

**Agreed.** §1.5 and §3.1/§3.2 (both agreed 2026-09-10) have a latent
tension, surfaced only now during implementation: §1.5 says the
scheduling job itself performs the idle→busy transition at assignment
time ("the only writer of idle→busy transitions is this job itself, so a
plain `UpdateItem` is safe") — a correctness point, avoiding a
double-claim race across Orders in the *same* scheduling run, since the
job's own loop is single-threaded but an operator claimed for Order A
must be unavailable by the time Order B (later in the same batch) queries
for an idle operator. §3.1/§3.2 instead assign `TRANSIT_STARTED` to the
state machine's `Dispatch` Lambda Task, which runs moments *later*
(asynchronously, after `StartExecution`) — too late to prevent that race.

**Resolution**: the scheduling job's claim step *is* the `TRANSIT_STARTED`
transition. `orderSchedulingService.dispatchOneOrder` calls a new
`OperatorDao.startTransit(operatorId)` (Query `gsi1-availability` for the
oldest idle Operator, then append `TRANSIT_STARTED`, clearing
`gsi1pk`/`gsi1sk` and setting `current_activity: TRANSIT` — same shape as
the existing `queueRemoval`/`finalizeRemoval` methods) synchronously,
*before* calling `orderDao.scheduleOrder` and starting the execution. The
`Dispatch` Lambda Task (§3.2) now fires **`ORDER_DISPATCHED` only** — the
Operator side already happened. This is a small correction to §3.1's
"each Task fires the matching pair" framing, not a reopening of it: the
pair still fires within the same synchronous scheduling-job call (Order
event via `orderDao.scheduleOrder`, Operator event via
`OperatorDao.startTransit`), just both on the scheduling-job side of the
line instead of split across the job and the state machine.

### 3.7 GPS pings on the `OperatorEvent` stream

**Agreed.** Pings piggyback on the existing `OperatorEvent` payloads
(no new table/entity) — each lifecycle event that represents a real
position carries a `location: { lat: number, lng: number }` field:

| Event | `location` |
|---|---|
| `OPERATOR_ADDED` | `HOME_DEPOT` (a fixed mock lat/lng constant, same "stub proves the shape" precedent as `MOCK_TRANSIT_MINUTES` et al. — a real depot/address entity is future work, not this leg). |
| `TRANSIT_STARTED` | Wherever the Operator's last recorded position was (`HOME_DEPOT` for a first dispatch, otherwise their previous job's site — see below). |
| `WORK_STARTED` | The assigned Order's `Location.latitude`/`longitude`, falling back to `HOME_DEPOT` if either is null (real 311 records are sometimes geodata-incomplete — same lenient precedent as `1-data-ingestion.md` §4). |
| `WORK_COMPLETED` | Same as `WORK_STARTED` — no return-to-depot leg is modeled. An Operator's GPS position sits at their last job site until their *next* `TRANSIT_STARTED`, whenever that is. This is deliberately simpler than snapping back to `HOME_DEPOT` on completion: a truck can't teleport, and fabricating a return trip with no corresponding transit/Wait would be a fake ping, not a real one. `TransitTimeEstimator` stays a flat constant either way (§3.1 of `capacity-model.md`'s "from depot" v1 model was never actually built — the real mock is unconditional), so this doesn't create an inconsistency with anything that exists today. |

`Operator`'s projection gets a new field, `current_location: { lat, lng }
| null` (`null` only pre-`OPERATOR_ADDED`, which never surfaces since the
projection doesn't exist yet either) — folded the same way every other
projection field is: each event handler that carries a `location` payload
sets it. This is what makes "tie pings together into a full path" cheap
today (replay one Operator's event history, already the source of truth)
and gives the eventual home-page map a live "where is this Operator right
now" read with no extra query.

**Explicitly out of scope for this leg** (per your own framing): pings
"every interval, based on actual movement" during the `Wait` states —
that needs the mock execution model to actually simulate interpolated
motion, which doesn't exist yet. Logged in `99-things-to-come-back-to.md`
once this leg ships.

### 3.8 Pre-scheduling hook — leading `Wait`

**Agreed.** Every execution still starts immediately today (an Operator
is only ever claimed when already idle) — but the state machine (§3.2)
gains a **leading `Wait` state**, `Wait(until: scheduled_start_datetime)`,
before `Dispatch`. `scheduled_start_datetime` is a field on the
`StartExecution` input, always `now` for this leg (matching the existing
`scheduledStart = deps.now()` in `dispatchOneOrder`). A future
pre-scheduling flow is then purely "pass a later timestamp" — no
state-machine redesign, no new deploy. `Wait` resolves effectively
instantly at `now`, so this is a zero-behavior-change addition today.

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

## Leg 5 — Admin Scheduling tile

### 5.1 Admin Scheduling tile

**Agreed.** A second Admin tile (alongside Capacity), `/admin/scheduling`
— an on-demand trigger for `scheduleOrders` ("kick off scheduling on
demand for testing purposes"), since it otherwise only runs on its
existing `rate(1 hour)` EventBridge Schedule. New admin-authorized route,
`POST /scheduling/run`, calling the same `scheduleOrders` service function
the scheduled Lambda already calls (one service, two controllers/trigger
types, per `CLAUDE.md` §5.2) — a button, a loading state, and a bare
success/failure result. Output statistics/a dashboard-style stats display
is **explicitly deferred** — you want to think through what that should
show before committing to it, so this leg does not build a stats panel,
persisted run history, or a `GET` status endpoint. (The scheduled job's
own `SchedulingRunSummary` is still logged via `logInfo`, same as always
— just not surfaced in the UI yet.)

---

## Leg 6 — Home-page fleet map + public GPS read path

### 6.1 Home-page fleet map + public GPS read path

**Agreed.** "A visual way to verify some of this execution" — the
home-page now renders a live map of every active Operator's current
position, color-coded by `current_activity` (green `IDLE`, amber
`TRANSIT`, blue `WORKING`). Current position only, no path/trail
rendering — §3.7 already reconstructs a full path by replaying an
Operator's event history if that's wanted later; this leg is deliberately
the simpler "where is everyone right now" view.

**The actual missing piece wasn't the GPS pings themselves** (§3.7 already
built those, riding on `OperatorEvent` payloads) **but a way to read them
out** — nothing before this leg could answer "where is the fleet" without
already being behind `AdminRoute`. New:

- `GET /fleet/locations` — **public**, unlike every other capacity route.
  Returns `{ operators: [{ operator_id, name, current_activity,
  current_location }] }` for the active roster — a narrower, public-safe
  projection than `Operator` (no `rate_per_hour`, `removal_requested_at`,
  timestamps, or `last_event_sequence`). New `backend/models/
  fleetLocation.ts`, `service/fleet/fleetLocationService.ts` (a separate
  service from `capacityService` — public read vs. admin CRUD are
  genuinely different concerns, not just a filtered view of one), and
  `controller/web-api/getFleetLocationsController.ts` (no
  `requireAdminUser` call, same as every other public `GET` route).
- `cdk/lambda/Nyc311GetFleetLocationsApiLambda.ts` — `OperatorsTable`
  `Query` only, no `UsersTable` grant (nothing to authenticate).
- `web-app/src/components/FleetMap.tsx` — Leaflet + OpenStreetMap tiles
  (free, no API key), new `leaflet`/`react-leaflet` dependencies. Rendered
  on `HomePage.tsx` via `useFleetLocations` (15s poll, matching other
  live-tile refresh cadences in this codebase).

---

## Build Checklist

**Legs 1, 2, 3, 5, and 6 built and locally verified 2026-09-12**
(build/lint/test/coverage green across `backend`/`cdk`/`web-app`, 90%+ per
file); Leg 4 not yet started. Capacity **is now wired into scheduling**
(Legs 3.5/3.6) — `orderSchedulingService.ts` claims a real idle `Operator`
and starts one execution per Order; the old `MockOperatorAssignmentDao`/
`mockCapacityAvailabilityProvider` stubs are deleted. Legs 3, 5, and 6 are
built and locally verified but **not yet deployed**.

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
- [x] `web-app/src/components/Header.tsx` — global sticky nav (app title, System Monitoring, Admin) wired once in `App.tsx`; Admin links straight to `/admin` and rides `AdminRoute`'s existing login-redirect/return-to-destination logic.
- [x] `test-scripts/8-capacity-crud-test.py` — on-demand live CRUD verification (add → read → remove → read → 400/404 checks), deliberately **not** added to the pipeline's automatic integration gate (would mutate real capacity rows on every deploy otherwise).
- [x] Unit tests, 90%+ per file, `backend`/`cdk`/`web-app` all green. Manually verified in the browser: add/remove both work end-to-end in mock mode, and again live against `Nyc311-Test` (web-app's `.env.local` pointed at the Test API + User Pool) through the real Admin UI via the new header nav.
- [ ] §2.3's all-time-cost warehouse job — not built, future work.
- [x] Deployed to `Nyc311-Test`, verified live via `test-scripts/7-seed-capacity.py` (seeded fleet to 10, $450/hr) + `8-capacity-crud-test.py` (401/create/read/remove/read/400/404 all passed, net fleet-size change zero) — 2026-09-12.
- [x] `name` added to `Operator`/`AddCapacityRequest` (required, free-text, not unique) — 2026-09-12, per explicit instruction to identify a vehicle past its id. Full stack: `backend/models/operator.ts`, `capacityRequest.ts`, `dao/operator/operatorDao.ts` (`addOperator(name, ratePerHour)`, stamped into the `OPERATOR_ADDED` payload), `service/capacity/capacityService.ts`, `addCapacityController.ts`; `web-app/src/models/operator.ts`, `services/capacityService.ts` (live + mock), `hooks/useCapacity.ts`, `components/capacity/{AddCapacityForm,CapacityRosterTable}.tsx`, `test-data/operators.ts`; `test-scripts/{7-seed-capacity,8-capacity-crud-test}.py`. **Breaking for existing data**: `name` is required on the `Operator` projection, and `OperatorDao.listActiveRoster`/`getOperator` parse strictly — any Operator row written before this change (the 10 seeded into `Nyc311-Test` earlier today) has no `name` and will fail validation once this deploys. Before/at deploy, clear `Nyc311-Test`'s `Operators` table (or re-run `7-seed-capacity.py` after a manual wipe) — there's no live Prod data yet, so Prod is unaffected.

**Leg 3 — Order execution simulation, built and locally verified 2026-09-12**
(build/lint/test/coverage green across `backend`/`cdk`/`web-app`, 90%+ per
file; visually verified live in the browser, mock mode). Not yet deployed.

- [x] `backend/models/order.ts` — `ORDER_DISPATCHED`/`ORDER_ARRIVED`/`ORDER_PROCESSING` added to `ORDER_EVENT_TYPES` (§3.1; `ORDER_RESOLVED` already existed).
- [x] `backend/models/gpsLocation.ts` — `GpsLocationSchema` + `HOME_DEPOT_LOCATION` mock constant (§3.7).
- [x] `backend/models/operator.ts` — `current_location: GpsLocation | null` added to the projection, folded from whichever `OperatorEvent` last carried one.
- [x] `backend/dao/operator/operatorDao.ts` — `findIdleOperator`, `startTransit`, `startWork`, `completeWork` (real event-sourced transitions, GPS pings per §3.7); `addOperator` now stamps `HOME_DEPOT_LOCATION` at creation.
- [x] `backend/dao/order/orderDao.ts` — `recordDispatched`, `recordArrived`, `recordProcessing`, `recordResolved`.
- [x] `backend/service/scheduling/orderSchedulingService.ts` — rewritten per §3.5/§3.6: pools/`CapacityAvailabilityProvider`/`MockOperatorAssignmentDao` deleted; claims a real idle Operator (`startTransit`, the idle→busy transition) before scheduling the Order and starting one execution per Order.
- [x] `backend/service/scheduling/orderExecutionStarter.ts` — `StartExecutionCommand` wrapper (new `@aws-sdk/client-sfn` dependency).
- [x] `backend/service/execution/orderExecutionService.ts` — `dispatchOrder`/`arriveAtJob`/`resolveOrder`; `getSimulationTimeScale()` reads a plain `SIMULATION_TIME_SCALE` env var (§3.3 amendment below).
- [x] `backend/models/orderExecutionTask.ts`, `backend/controller/order-processing/orderExecutionController.ts` — the phase-routed (`DISPATCH`/`ARRIVE`/`RESOLVE`) Step Functions entry point (§3.2).
- [x] `cdk/lambda/Nyc311OrderExecutionLambda.ts`, `cdk/step-function/Nyc311OrderExecutionStateMachine.ts` — `Wait(scheduled_start_datetime) -> Dispatch -> Wait(transit) -> Arrive -> Wait(processing) -> Resolve` (§3.2/§3.8).
- [x] `cdk/lambda/Nyc311OrderSchedulingLambda.ts` — Operators grants + `ORDER_EXECUTION_STATE_MACHINE_ARN`/`states:StartExecution`; Cases grant removed (pool-derived unroutable path gone).
- [x] §3.5 Dropping capacity pools from scheduling, §3.6 Resolving the idle→busy claim timing, §3.7 GPS pings, §3.8 Pre-scheduling hook — all designed and built this pass (see those sections above).
- [~] §3.3 Sim-time config — **amended**: a plain per-environment `SIMULATION_TIME_SCALE` env var (100 for Test, 1 for Prod), not AWS AppConfig as originally sketched. Nothing yet needs to change the scale without a redeploy; swapping to AppConfig later is a drop-in change behind `getSimulationTimeScale()`, not a state-machine redesign — logged as a possible future refinement, not a gap.
- [ ] §3.4 Failure injection at `EXECUTE` — deliberately deferred, as agreed.
- [ ] Not yet deployed to `Nyc311-Test`/verified live — pending push/deploy. **Same breaking-data-shape gotcha as `name` earlier**: `current_location` is a new required `Operator` projection field, and `OperatorDao.listActiveRoster`/`getOperator`/`findIdleOperator` all parse strictly — whatever's currently seeded into `Nyc311-Test` (added after the `name` fix, but before this leg) has no `current_location` and will fail validation once this deploys. Clear/re-seed `Operators-Test` before or immediately after this deploy.

**Leg 5 — Admin Scheduling tile, built and locally verified 2026-09-12.**
- [x] `backend/controller/web-api/runSchedulingController.ts` — `POST /scheduling/run`, admin-authorized, calls the same `scheduleOrders` the hourly schedule already runs.
- [x] `cdk/lambda/Nyc311RunSchedulingApiLambda.ts`, `cdk/api/Nyc311Api.ts` route wiring.
- [x] `web-app/src/services/schedulingService.ts` (real + mock), `hooks/useScheduling.ts`, `components/pages/SchedulingManagementPage.tsx` (routed at `/admin/scheduling`), `SchedulingIcon` added to the shared icon set, second Admin tile.
- [x] Deliberately no output-statistics display, persisted run history, or `GET` status endpoint (§5.1) — you want to think that through before committing to it.
- [ ] Not yet deployed to `Nyc311-Test`/verified live — pending push/deploy.

**Leg 6 — Home-page fleet map + public GPS read path, built and locally verified 2026-09-12.**
- [x] `backend/models/fleetLocation.ts` — `FleetOperatorLocation`/`FleetLocations`, the public-safe subset of `Operator`.
- [x] `backend/service/fleet/fleetLocationService.ts`, `controller/web-api/getFleetLocationsController.ts` — `GET /fleet/locations`, public, no `requireAdminUser`.
- [x] `cdk/lambda/Nyc311GetFleetLocationsApiLambda.ts` — `OperatorsTable` `Query` only.
- [x] `web-app/src/models/fleetLocation.ts`, `services/fleetLocationService.ts` (real + mock), `test-data/fleetLocations.ts`, `hooks/useFleetLocations.ts`, `components/FleetMap.tsx` (Leaflet + OpenStreetMap, new `leaflet`/`react-leaflet` deps), rendered on `HomePage.tsx`.
- [x] Current position only — no path/trail rendering yet (§3.7 already supports reconstructing one from event history if wanted later).
- [x] Unit tests, 90%+ per file, `backend`/`cdk`/`web-app` all green. Manually verified in the browser (mock mode): real map tiles, 7 mock vehicles color-coded by activity, popup on click showing name + activity.
- [ ] Not yet deployed to `Nyc311-Test`/verified live — pending push/deploy.

**Leg 4 — Test DB cleanup script**: not started — `test-scripts/9-reset-test-data.py`.
