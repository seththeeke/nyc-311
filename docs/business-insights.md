# Business Insights & Analytics (negotiated 2026-07-29)

> This document extends `claude-prompt-initial.md` §9 (Metrics to Track) and builds
> directly on `docs/capacity-model.md`. Where the original brief listed metrics at a
> high level, this doc defines: (1) a concrete **cost model** treating the simulation
> as a cost center, (2) precise **resolution/SLA metrics**, and (3) the **analytics
> infrastructure** used to compute and serve all of it. It also introduces one new
> domain entity — `Shift` — needed to make cost attribution work cleanly.

---

## 1. Cost Model

### 1.1 Cost components (v1)

| Component | Basis | Notes |
|---|---|---|
| Labor cost | Unit-hours on shift × hourly rate | Rate varies **by unit type (agency)** only — not by borough. Applies across the whole shift (driving, working, and idle time alike), since labor is paid continuously regardless of activity. |
| Transit cost | Distance traveled × $/mile rate | Rate varies **by unit type (agency)** — different vehicle types have different fuel/wear profiles. Distance comes from the same transit-time calculation defined in `capacity-model.md` §3.1. |
| AWS platform cost | Pulled from the AWS Billing/Cost Explorer API on a schedule | **System-wide only** — a real dollar figure representing what it costs to run the platform itself. Deliberately **not allocated or attributed to any persistent domain record** (no per-Order, per-complaint_type, or per-borough split stored anywhere). If a blended "cost per order including platform overhead" figure is wanted, it's computed **at query/analytics time** as `period_platform_cost / orders_in_period` — never written back into the operational data model. |
| Case-handling cost | *(deferred)* | Will eventually be modeled as a labor cost (agent invocation + human dispatcher time), but explicitly out of scope for v1. Framing to carry forward: cost incurred by human escalation should read as "cost of a defect the system couldn't self-resolve," not a routine operating expense — it's a signal, not just a line item. |

### 1.2 The `Shift` entity

Labor cost doesn't naturally attach to an Order — a unit's paid time is continuous
across a whole shift and gets spent on multiple jobs, idle waiting, and a paid
return-to-base leg at shift end. Stamping cost directly onto `Order` would force
arbitrary rules for that non-order-attributable time. Instead, cost is computed from
a new entity that represents the actual unit of "continuously paid time":

**`Shift`** (event-sourced, same pattern as `Order` — the entity's current state is a
projection derived by folding its event stream):

- `shift_id`, `unit_id`, `pool` (agency + borough, per `capacity-model.md` §1),
  `depot_id`, `rate_per_hour` (stamped from the labor rate table **at shift start**,
  so historical cost stays stable even if rates change later), `scheduled_start`,
  `scheduled_end`.

**`ShiftEvent`** (append-only, source of truth): `ShiftStarted`,
`TransitStarted{order_id}`, `WorkStarted{order_id}`, `WorkCompleted{order_id}`,
`IdleStarted` (waiting for next dispatch), `ReturnToBaseStarted` (paid final leg back
to depot), `ShiftEnded`.

Everything cost-related is derived from this single log — nothing is duplicated:

- **Total labor cost for a shift** = shift duration × `rate_per_hour`.
- **Transit cost for a given job** = distance covered during that job's
  `TransitStarted → WorkStarted` segment × the unit-type $/mile rate.
- **Cost attributable to a given Order** = sum of that Order's segments (transit +
  work time), possibly spanning more than one `Shift` if a job carries across a shift
  handoff. This is a **downstream analytics computation** — `Order` does not store a
  cost field.
- **Paid idle time** — any `IdleStarted`/`ReturnToBaseStarted` segment: time paid for
  but not attributable to any Order. Tracked as its own metric (§2.3) — a direct
  signal of over-capacity.

### 1.3 Order ↔ Shift linkage

- The **Schedule stage** (`capacity-model.md` §8) stamps the *plan* — an
  `OrderScheduled` event carries `shift_id` + `unit_id` as a plain reference (the
  assignment), plus the computed scheduled window.
- A separate **`OrderCheckedIn`** event marks the moment the assigned unit actually
  begins work on this specific Order — this, not the scheduling timestamp, is what
  starts the cost-accruing clock. The gap between being scheduled and checking in
  (dispatch latency, or time the unit spends finishing/idle before reaching this job)
  is not charged to the Order; it shows up on the `Shift`'s own timeline instead
  (as idle time, or as another Order's segment).

---

## 2. Resolution & SLA Metrics

### 2.1 Two distinct "time to resolve" metrics

| Metric | Measures | From → To |
|---|---|---|
| Order resolution time | End-to-end fulfillment, including queueing/transit/work | `OrderCreated` → `OrderResolved` |
| Case MTTR (mean time to resolve) | How long a failure/escalation takes to clear, the classic incident-response sense of MTTR | `CaseCreated` → `CaseClosed` |

Both are tracked as **separate, named metrics** — they answer different questions
(system throughput vs. failure-handling speed) and shouldn't be blended.

### 2.2 Two distinct SLA concepts

It's important these aren't conflated — they gate different things:

1. **Queue-wait SLA** (`capacity-model.md` §6) — a maximum wait time an Order can sit
   unscheduled before it's considered a capacity shortfall. Breaching it is what
   **creates** a capacity-escalation Case in the first place.
2. **Case resolution-time SLA** — a separate, admin-configurable "must be closed
   within X" clock that starts when *any* Case is created (system-failure or
   capacity-escalation), independent of what created it. **"SLA breach" as a
   reported metric refers to this clock** — a Case still open past its threshold.
   This is the concept that also covers system-failure Cases, which were never
   subject to a queue-wait SLA in the first place.

Both thresholds are configurable per case/complaint type, per the admin-configurable
business-input principle established in `capacity-model.md` §6.

### 2.3 Breakdown dimensions

MTTR, median resolution time, and SLA-breach rate are broken down by:
- **Complaint type**
- **Borough**

(Breakdown by case queue/owner or priority tier was considered and intentionally
left out of v1 scope — not enough signal value yet to justify the added dimension.)

### 2.4 Considered, not in scope for v1

The following categories were discussed and explicitly deferred — kept here so they
aren't re-litigated from scratch later:
- Capacity utilization & idle cost (utilization rate per pool, idle cost as % and $
  of labor cost, queue depth/backlog trend) — natural to add once `Shift` data exists.
- Throughput/productivity (Orders resolved per unit per shift, intake vs. resolved
  volume over time).
- Defect rate (% of Orders spawning a Case, split by system-failure vs.
  capacity-escalation cause).
- Agent trust/reliability metrics (per-persona auto-resolve vs. escalation rate,
  confidence distribution, rate of auto-resolved Cases later reopened by a human).

---

## 3. Analytics Infrastructure

DynamoDB (the operational store) is good at transactional access, not at
cross-entity aggregation — the queries this doc needs (cost by borough by day, MTTR
by complaint type, etc.) need a proper analytical layer fed from the same event
streams that already drive `Order`, `Shift`, and `Case`.

### 3.1 Pipeline shape

```
DynamoDB Streams (OrderEvent, ShiftEvent, CaseEvent)
        │
        ▼
Kinesis Data Firehose  ──▶  S3 (raw landing zone, Parquet)
        │
        ▼
Glue Data Catalog (manual DDL — see §3.5)
        │
        ▼
Athena  (SQL jobs authored by the business owner — see §3.4)
        │
        ▼
DynamoDB (dashboard-ready aggregate tables — see §3.6)
        │
        ▼
Admin / Public dashboard API (unchanged from original §5 design)
```

### 3.2 Engine choice: S3 + Athena, not Redshift

Considered Redshift Serverless (a literal data-warehouse cluster: distkeys, sortkeys,
materialized views, WLM) against S3 + Athena (serverless SQL, no cluster to manage,
pay per query scanned). **Chose Athena** — no idle/base cost, which fits both the
low event volume (a few 311 polls/day) and the portfolio-project cost sensitivity,
while still delivering the thing that mattered most: authoring and owning real SQL
jobs against a genuine data-lake layer.

### 3.3 Ingestion: Kinesis Firehose

DynamoDB Streams → **Kinesis Data Firehose** → S3. Chosen over a custom
Streams-consuming Lambda: at this project's data volume the dollar cost of either
path is negligible (Firehose: low single-digit dollars/month at most; Lambda: likely
$0 under the free tier), so the deciding factor was managed batching + built-in
Parquet conversion (Firehose) vs. full control at the cost of owning that code
(Lambda). Firehose won on "less to build and maintain" grounds, not cost.

### 3.4 Job authoring & orchestration

- SQL jobs (aggregation queries, written as `CTAS`/`INSERT INTO` statements against
  the raw event tables) are **authored and owned by the business owner** — no
  auto-generated queries.
- Scheduling/execution: **EventBridge Scheduler → Step Functions → Athena**
  (`StartQueryExecution`, poll for completion, chain subsequent queries). Mirrors the
  existing Order/Case Workflow pattern already used elsewhere in the stack, and gets
  per-step retry/visibility for free rather than hand-rolling a polling loop in a
  single Lambda.

### 3.5 Table cataloging

Glue Data Catalog tables will be defined via **manual DDL** (explicit
`CREATE EXTERNAL TABLE` statements, not an auto-inferring Glue Crawler) — consistent
with wanting to author and verify the SQL/schema directly rather than relying on
inference.

**[OPEN]** The mechanics of authoring/deploying this DDL (e.g. via CDK, Athena
console, or a migration-style script) are not yet understood in detail — revisit
this specifically when implementation begins.

### 3.6 Serving layer

Each Athena job's output (small, pre-aggregated result tables — e.g. "cost by
borough by day") is copied into a **dedicated DynamoDB table** after the job
completes. The dashboard API reads from DynamoDB exactly like every other read path
in the system — no per-view Athena query cost, no unusual latency, no second
data-serving pattern to maintain alongside the existing API-Gateway-to-DynamoDB one.

---

## 4. Still Open

- Exact Athena SQL/table design for each metric (cost breakdowns, MTTR, SLA-breach
  rate) — write the actual queries once real event data exists to test against.
- Glue Data Catalog DDL authoring/deployment mechanics (§3.5).
- Case-handling cost model, once added (§1.1).
- Whether/how the "considered, not in scope" metrics (§2.4) get added later, and
  whether any require new fields beyond what `Shift`/`Order`/`Case` already capture.
