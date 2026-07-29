# Capacity Model & Business Inputs (negotiated 2026-07-29)

> This document extends `claude-prompt-initial.md`. The original brief modeled the
> Order Workflow as a pipeline with no resource constraints — an Order simply moved
> stage to stage. This doc adds a **capacity layer**: a fixed, admin-controlled set of
> crews/trucks that gate how fast Orders actually get worked, which is what turns this
> from a pure workflow demo into something that behaves like a business with finite
> resources, backlog, and prioritization tradeoffs.
>
> It also **amends** a few specifics already negotiated in the original brief. Those
> are called out explicitly in §7 rather than silently overwritten there.

---

## 1. Capacity Pools

Capacity is partitioned by **(agency, borough)** — one pool per pair (e.g. "DSNY –
Queens", "NYPD – Brooklyn"). Trucks/crews are not fungible across this boundary: a
unit is scoped to one agency (skill/equipment match) and one borough (geography), so
a pool's unit count is the thing the business owner directly sets as an input.

Each pool has:
- `unit_count` — number of dispatchable units, admin-configurable.
- One **depot** (home/base location) per pool. Units originate from and return to
  this single location at shift boundaries. (Multiple depots per pool was
  considered and deferred — not worth the added assignment complexity for v1.)

---

## 2. Units, Concurrency, and Shifts

> **See also** `docs/business-insights.md` §1.2 — the `Shift` entity (event-sourced,
> mirrors `Order`) is the concrete data model for what's described conceptually in
> this section, and is what cost/idle-time metrics are derived from.

- **Concurrency model**: each unit can have at most one Order actively in progress
  at a time (drive + work). N units in a pool = N Orders that can be in flight
  concurrently for that pool; everything else queues at the Schedule stage (§7.2).
- **Service time** for an Order = **transit time** (depot/current location → job
  location) + **processing time** (on-site work). Both are pluggable — see §3.
- **Shifts**: units work fixed **8-hour shift blocks**. Shift start times are
  themselves a configurable input, and multiple shifts can be staggered across a
  pool so coverage doesn't collapse to zero at shift-change (e.g. not all units in a
  pool return to base simultaneously).
- **Shift handoff**: once a unit can no longer complete more work within its
  remaining shift time, it stops taking new assignments and is replaced by a fresh
  unit dispatched from the pool's depot. (Precise handoff mechanics — e.g. whether a
  job already in progress is allowed to run past shift end to finish, vs. a hard cutoff
  — still to be defined during implementation.)

---

## 3. Pluggable Timing Interfaces

Both timing inputs are implemented as explicit interfaces so the underlying model can
be improved independently without touching queueing/shift/dispatch logic.

### 3.1 `TransitTimeEstimator`
- **v1 implementation**: Haversine straight-line distance (from lat/long already
  present on every 311 record) divided by an assumed average city driving speed.
- Interface is deliberately generic so a future implementation (real routing API,
  traffic-aware model, etc.) can be swapped in without changing callers.

### 3.2 `ProcessingTimeEstimator`
- **v1 implementation**: fixed duration per `complaint_type` (e.g. "Noise -
  Residential" = 20 min, "Rodent" = 45 min), configured as an admin-tunable lookup.
- Interface allows a future move to distribution-sampled or otherwise more complex
  processing-time models without touching the rest of the system.

---

## 4. Staffing / Capacity Availability

Two concerns are deliberately decoupled:

1. **Staffing model** (the "how many units are on shift right now" logic) — built
   around discrete shift blocks (§2), informed by a **forecasting component** that
   takes historical/incoming complaint volume as input to recommend staffing levels
   per pool. This is where "should we run more units on Tuesday afternoons" logic
   lives.
2. **`CapacityAvailabilityProvider`** — the interface the execution/dispatch engine
   actually queries ("how many units are available for pool X right now"). The
   engine has no knowledge of shifts, forecasting, or staffing strategy — it just
   consumes an availability number. This means the staffing/shift model can be
   redesigned entirely (different shift structure, a headcount-based model, whatever
   comes later) without touching dispatch/queueing code.

**[OPEN]** Whether/how capacity Cases (§6) feed back into the forecasting component
as a signal ("this pool is chronically under-capacity") — not yet decided.

---

## 5. Priority Model

Real NYC 311 data has no priority field, so priority is invented for the simulation,
using **both** of the following together:

- **Static base tier**, assigned at intake from `complaint_type` (e.g. "Gas Leak" =
  high, "Noise" = medium, "Illegal Parking" = low).
- **Dynamic aging escalation** — an Order's effective priority increases the longer
  it waits in queue without being dispatched, so a low-priority Order that's been
  waiting a long time naturally rises above a fresher high-priority one.

---

## 6. SLA Thresholds and Capacity Cases

- Each case/complaint type has a **fixed maximum queue wait time** (an SLA
  threshold), admin-configurable, separate from (though related to) the priority
  aging mechanic in §5.
- When an Order's queue wait exceeds its type's SLA threshold, a **Case is
  created** — the mechanism for surfacing "capacity shortfall" as a first-class,
  trackable event rather than just a metric.
- All of these thresholds — transit speed assumption, processing durations, pool
  unit counts, shift schedules, SLA thresholds — are **business inputs** meant to be
  exposed in the eventual Admin configuration surface (extends the "manage service
  catalog" item in the original brief's §5), not hardcoded constants.

---

## 7. Case Queue Split and Agent Isolation

This is the most significant amendment to the original Case model (§3.5/§4.2 of
`claude-prompt-initial.md`).

### 7.1 Two Case queues, two owners
A Case's origin now determines which queue — and which owner — it belongs to:

| Queue | Trigger | Owner |
|---|---|---|
| System-failure | Exhausted retries / unrecoverable error at a workflow stage (original §4.1 behavior) | Developer/operator |
| Capacity-escalation | SLA breach — Order waited past its threshold (§6) | Human dispatcher |

This requires a new routing field on `Case` (queue/owner), beyond the existing
`status`/`assigned_admin` fields defined in §3.5 of the original brief.

### 7.2 Every Case is triaged by an agent first
Both queues go through automated agent triage before any human involvement — this
still satisfies the original §4.2 "Agentic Investigation" step conceptually, but the
investigation is no longer a single undifferentiated step.

### 7.3 Two isolated agent personas, not one adaptable agent
Given the two queues carry genuinely different context (system/execution internals
vs. queue/capacity state) and genuinely different action sets, **and** may be
exposed to humans for follow-up/deep-dive later, prompt-level separation alone
(one Lambda, different system prompt per case type) was rejected as insufficient —
it's an advisory boundary, not an enforced one, and doesn't protect against a
dispatcher-facing session being able to reach operator-only context/tools.

**Decision**: two separate **Managed Agents for Bedrock** resources:

- **System-failure triage agent** — context includes Order/stage/execution history;
  action set oriented around retry/duplicate/no-action-needed style resolutions
  (per original §4.2). Owned by the operator/developer queue.
- **Capacity-escalation triage agent** — context includes queue depth, wait time,
  capacity pool state, priority; action set oriented around
  reprioritization/capacity-recommendation style resolutions. Owned by the
  dispatcher queue.

Each has its **own IAM role and its own action group** (Bedrock enforces which
Lambda tools each agent can call), giving a real least-privilege boundary rather
than one shared execution context that happens to be prompted differently. This is
deliberate: it demonstrates a real security pattern (data isolation between a
system-internals-facing persona and a human-facing persona), not just an agentic UX
choice.

**[OPEN]** Exact bounded action set for each persona — still to be designed once
real failure/capacity patterns are observable, consistent with the original brief's
approach to §4.2.

---

## 8. Amendments to the Order Workflow (§4.1 of the original brief)

- **`Plan` stage removed.** Workflow is now `Ingest → Schedule → Execute → Resolve`
  (was `Ingest → Schedule → Plan → Execute → Resolve`).
- **`Schedule` stage redefined** as the actual queueing/capacity-assignment step: it
  takes current pool capacity, transit-time ETA, and processing-time ETA, and
  computes the next available slot for the Order.
- The computed **scheduled window** (expected start/end) is recorded via a
  Schedule-stage `OrderEvent` (e.g. `OrderScheduled`) and surfaces on the **Order**
  projection (`scheduled_start`/`scheduled_end`) — **not** written onto `Request`.
  This preserves the original design principle that `Request` is raw, largely
  immutable intake (§3.3) and that all workflow state belongs to the event-sourced
  `Order` (§3.4).

---

## 9. Still Open

- Exact bounded action sets for both agent personas (§7.3).
- Whether capacity Cases feed back into the staffing forecast (§4).
- Precise shift-handoff mechanics for a job in progress at shift end (§2).
- DynamoDB schema implications of capacity pools, depots, shifts, and scheduled
  windows — still pending the broader table-design [OPEN] item in the original
  brief's §3.6.
- Admin configuration schema covering all business inputs named in §6.
