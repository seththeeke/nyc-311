# Data Warehousing — Orders/OrderEvents/Requests Into a Queryable SQL Store

> **Status: Legs 1–3 + the `/data` frontend shipped to `Nyc311-Prod`
> (2026-09-06). The serving layer was reworked 2026-09-07 — job results
> are resultsets in S3, not rows in a DynamoDB table** (see §8/§11 and
> Appendix A.10). Leg 4 (on-demand rebuild) shipped + verified 2026-09-09; Leg 5
> (observability) runs on OOTB metrics for now with the alarm suite
> deferred to [#25](https://github.com/seththeeke/nyc-311/issues/25).
> **Leg 6 (`Operators` joins the pipeline) built 2026-09-13, deploy
> in progress. Leg 7 (admin ad-hoc SQL console) built and manually
> verified in the browser (mock mode). Leg 8 (self-service job
> authoring — DDB+S3 job definitions, per-job EventBridge Scheduler
> schedules, replacing checked-in `.sql` files + one shared static
> schedule) built 2026-09-13 (backend, CDK, and frontend all
> implemented and fully tested; not yet deployed or live-verified)** —
> see the [Build Checklist](#build-checklist).
> Written **declaratively** — this doc describes the current design, not
> the negotiation that produced it. Tradeoffs, rejected alternatives, and
> the reasoning behind each call live in the
> [Appendix](#appendix-design-rationale--alternatives-considered), not
> inline. Anything still genuinely undecided is called out explicitly in
> [Open Items](#open-items).
>
> This is the implementation-level build-out of `business-insights.md` §3
> ("Analytics Infrastructure"), which set the top-level engine choices:
> **S3 + Athena, not Redshift** (§3.2); **Kinesis Firehose for landing**
> (§3.3); **manual Glue DDL, no crawler** (§3.5). It diverges from §3.4/§3.6
> deliberately: job orchestration is **one generic EventBridge → Lambda →
> Athena runner**, not a per-job Step Functions machine (Appendix A.10),
> and job output is **an immutable resultset in S3 + an Athena-queryable
> history table**, not pre-aggregated rows in a DynamoDB serving table.
> The reframe: this is the **reporting substrate for the whole app** — a
> job is `{ name, SQL }`, its output is stored verbatim, and any
> presentation layer (the `/data` page, a future feature, ad-hoc Athena, a
> user-authored query) structures it as needed. This doc supersedes
> `business-insights.md` §3.1/§3.3/§3.4/§3.6 where they conflict (see
> Appendix A.9/A.10) and closes every `[OPEN]` item that section left.
>
> `backend/`/`cdk/` are unlocked (`CLAUDE.md` §5.1/§5.2). `.sql` files as
> versioned assets under `cdk/warehouse/sql/` is an established convention
> as of Leg 3 (`CLAUDE.md` §5.3).

---

## 1. Architecture Overview

```
DynamoDB: Orders table          DynamoDB: Requests table
        │  Streams                       │  Streams
        ▼                                ▼
Nyc311OrdersStreamFanOutLambda   Nyc311RequestsFanOutLambda
   (existing, widened)              (existing, widened)
        │  sns:Publish, routed by record shape
        ▼
┌───────────────────────────────────────────────────────────┐
│ SNS: Nyc311OrderEventsTopic / Nyc311OrderProjectionsTopic /│
│      Nyc311RequestEventsTopic                              │
└───────────────────────────────────────────────────────────┘
   │ unfiltered subscription (×3)      │ existing filtered subscription
   ▼                                    ▼ (unchanged — order evaluation /
Kinesis Firehose (×3, Parquet            request ingestion pipelines)
conversion against the Glue schema)
   │
   ▼
S3: s3://nyc311-warehouse-<env>/data/<entity>/dt=<date>/*.parquet
   │
   ▼  (Glue Data Catalog: order_events, order_snapshots, requests)
   │
   ├──────────────► Athena (ad-hoc SQL, console/CLI)
   │
   ▼
EventBridge Scheduler (daily) ──► Nyc311WarehouseJobRunner (one Lambda)
                                       │  for each cdk/warehouse/sql/<job>.sql:
                                       │  run in Athena, then
                                       ├─► s3://…/job-results/job_name=<job>/run_date=<date>/result.json
                                       │        (immutable, self-describing: columns + string-valued row objects)
                                       │        └─► Glue table job_results (one, CDK-declared, over the whole
                                       │             prefix) → Athena "trend of trends" via CROSS JOIN UNNEST
                                       └─► WarehouseJobRuns (DynamoDB) — run log + pointer to result_location
                                                │                            (also written by the rebuild, §10)
                                                ▼
                       GET /data/jobs, GET /data/jobs/{name}/result (S3 GetObject),
                       GET /data/schema (live Glue read)
                                                │
                                                ▼
                                  /data page (public, read-only) — one renderer per job
```

A separate, on-demand **`Nyc311WarehouseRebuildStateMachine`** (§10) can
fully wipe and re-derive any source's warehoused data straight from
DynamoDB at any time, independent of this live pipeline.

---

## 2. Scope

This build delivers, end to end, for **`Orders` (both `OrderEvent` and the
`Order` projection), `Requests`, and `Locations`** (the last added
2026-09-07 once that data existed):

- Live change capture off DynamoDB into S3, catalogued in Glue and
  queryable ad hoc in Athena.
- Real scheduled aggregations on a generic EventBridge → Lambda → Athena
  job runner — `order_volume_by_stage_7d` (created-date × current stage,
  trailing week), `order_volume_by_stage_8w` (creation-week × stage,
  trailing 8 weeks), and `order_volume_by_borough` (`order_snapshots`
  joined to `locations`). Output is an immutable resultset in S3 plus an
  Athena-queryable history table; no presentation-specific shaping lives
  in the job layer.
- Job run history, automatic bounded retry, and query-performance metrics
  for every run.
- An on-demand rebuild (`Nyc311WarehouseRebuild` state machine, §10) that
  wipes and re-derives every source's warehoused data from a DynamoDB PITR
  export without pausing live capture (Leg 4, 2026-09-08).
- A public, read-only `/data` page surfacing warehouse schema, job
  history, and the latest resultset of each job; a `/reports` page for
  business-facing weekly trends (`GET /reports`, 2026-09-07).

**Leg 6 (2026-09-13) adds `Operators`** — both `OperatorEvent`
(`operator_events`) and the `Operator` projection (`operator_snapshots`),
joining the pipeline exactly as §3's design principle promised: one more
fan-out branch, one more pair of Firehoses, two more Glue tables, no
redesign. This unblocks `10-capacity-modeling-and-integration.md` §2.3's
"all-time accumulated cost" job.

**Leg 7 (2026-09-13) adds an admin-only ad-hoc SQL console** — a
`POST /admin/warehouse/query` route and an Admin-page tile, letting the
single admin user run a one-off `SELECT` against the warehouse and see the
result rendered as a table, no `.sql` file or deploy required.

**Leg 8 (2026-09-13) replaces checked-in `.sql` files with self-service
job authoring** — a job is now a DynamoDB definition (name, cron
cadence) pointing at its SQL in S3, with its own EventBridge Scheduler
schedule created/deleted at runtime through `/admin/warehouse`'s Jobs
tab (§12b) — no `.sql` file, no deploy, to register or retire a job.
Together, Legs 7 and 8 substantially close the "user-authored SQL jobs /
ad-hoc query API" Open Item — general multi-tenant auth and
saved-but-not-scheduled query history remain the only pieces still
deferred (see [Open Items](#open-items)).

**Explicitly out of scope** (see [Open Items](#open-items)):
`business-insights.md` §2's other aggregations (though authoring one is
now a Jobs-tab action, not a code change), `Cases`/`Shifts` (not built
yet), any write action on `/data` itself, and a real multi-user auth
model beyond the single admin `9-admin-auth-integration.md` already
established.

---

## 3. Data Sources

| Source | Warehouse table | Role |
|---|---|---|
| `Orders` table — `OrderEvent` items (`EVENT#<n>`) | `order_events` | Fact stream — every `ORDER_CREATED`/`ORDER_ACCEPTED`/`ORDER_REJECTED`/`ORDER_SCHEDULED`/… with `occurred_at`, `stage`, `actor`, `payload`. |
| `Orders` table — `#METADATA` projection | `order_snapshots` | Current-state dimension — `current_stage`, `status`, `location_id`, `sla_deadline`, `priority_tier`, etc. as plain typed columns. |
| `Requests` table — real `Request` rows | `requests` | Intake dimension + status CDC — `complaint_type`, `agency`, `created_at`, and every `DRAFT → PROMOTED/FILTERED/DUPLICATE/REJECTED` transition. |
| `Locations` table — real `Location` rows | `locations` | Geography dimension — `bbl`, `borough`, `zip`, `latitude`/`longitude`, joined to `order_snapshots`/`requests` on `location_id`. Written once per `bbl` (`findOrCreate`), never updated — `INSERT`-only. |
| `Operators` table — `OperatorEvent` items (`EVENT#<n>`) | `operator_events` | Fact stream — every `OPERATOR_ADDED`/`OPERATOR_REMOVAL_REQUESTED`/`OPERATOR_REMOVED`/`TRANSIT_STARTED`/`WORK_STARTED`/`WORK_COMPLETED` with `occurred_at`, `actor`, `payload` (Leg 6, 2026-09-13). |
| `Operators` table — `#METADATA` projection | `operator_snapshots` | Current-state dimension — `status`, `current_activity`, `rate_per_hour`, `start_datetime`/`end_datetime`, `current_location` as plain typed columns. Backs `10-capacity-modeling-and-integration.md` §2.3's all-time-cost job (Leg 6, 2026-09-13). |

**Excluded, by design:** `Requests`' `METRIC#<ulid>` poller-metrics rows
and `CURSOR#NYC_311` sentinel (operational, already served by
`GET /ingestion/metrics`) — the widened fan-out Lambda's relevance check
(§4) filters these out before they ever reach a topic.

**Deferred:** `CaseEvent`/`Cases`, `Shifts` (neither table exists yet).
When either ships, it attaches to this exact pipeline the same way — one
more fan-out branch, one more Firehose, one more Glue table — not a
redesign. `Operators` made exactly this move in Leg 6 (2026-09-13, above).

---

## 4. Change Capture

`Nyc311OrderEventFanOutLambda` and `Nyc311OrderFanOutLambda` are renamed
and widened in place — no new Lambda, no new DynamoDB Streams consumer.

**`Nyc311OrdersStreamFanOutLambda`** (renamed from
`Nyc311OrderEventFanOutLambda`; still the sole consumer on the `Orders`
table's stream) routes every stream record by `sk`:

- `sk` starts `EVENT#` → `sns:Publish` to `Nyc311OrderEventsTopic`
  (unchanged from today).
- `sk === "#METADATA"` → `sns:Publish` to the new
  `Nyc311OrderProjectionsTopic`.

**`Nyc311RequestsFanOutLambda`** (renamed from `Nyc311OrderFanOutLambda`;
still the sole consumer on the `Requests` table's stream) no longer calls
`sqs:SendMessage` directly. Its relevance check covers any real Request
row (`INSERT` or `MODIFY`, has `request_id`, not the `CURSOR#NYC_311`/
`METRIC#<ulid>` sentinels), and it `sns:Publish`es every one — tagged with
an `event_name` message attribute (`INSERT`/`MODIFY`) — to the new
`Nyc311RequestEventsTopic`. Filtering for the existing operational
consumer moves from in-handler code to a declarative SNS filter policy:

- `Nyc311OrderIngestionQueue` subscribes with filter policy
  `{event_name: ["INSERT"]}` — reproduces today's exact "new Requests
  only" behavior for request evaluation, unchanged downstream.
- The warehouse's Firehose subscribes **unfiltered** — receives both
  `INSERT` and `MODIFY`, landing the full status-transition history.

Both Lambdas' destinations remain declared in CDK — every topic/queue a
Lambda can publish to is infrastructure, not an in-handler side channel.

**`Nyc311LocationsFanOutLambda`** (new, added 2026-09-07 when `Locations`
data appeared in the tables) — the `Locations` stream's sole consumer.
`Locations` is `INSERT`-only (`findOrCreate` by `bbl`, never updated), so
the fan-out is trivial: `sns:Publish` every new row to
`Nyc311LocationEventsTopic`, tagged `event_name` (always `INSERT`), for
the `locations` warehouse Firehose. No DAO calls, `sns:Publish` only.
Enabling the stream on the existing `Locations` table is a non-replacing
update.

**`Nyc311OperatorsStreamFanOutLambda`** (new, Leg 6, 2026-09-13) — the
`Operators` table's first stream consumer (`10-capacity-modeling-and-integration.md`
§1.4 noted the table shipped with no stream; this is that non-replacing
update). Routes by `sk`, the same shape as `Nyc311OrdersStreamFanOutLambda`
since `Operators` is event-sourced (`EVENT#`/`#METADATA`) like `Orders`,
not `INSERT`-only like `Locations`:

- `sk` starts `EVENT#` → `sns:Publish` to the new `Nyc311OperatorEventsTopic`.
- `sk === "#METADATA"` → `sns:Publish` to the new `Nyc311OperatorProjectionsTopic`.

Unlike `Orders`, **neither topic has an operational subscriber** — nothing
in this codebase reacts to an Operator's stream today, so both topics feed
the warehouse only. Two topics (not one with a filter policy) is still the
right shape: it mirrors `Orders`' established precedent exactly and leaves
room for a future operational consumer to subscribe to one without
touching the other. **Placement (best guess, flag if wrong):** the
controller/service live under `controller/ingestion/`
`fanOutOperatorEventsController.ts` /
`service/ingestion/operatorEventService.ts`, mirroring
`fanOutLocationEventsController.ts`/`locationEventService.ts` — `Operators`
has no own `controller/*-processing/` directory (unlike `Orders`, which
reused `order-processing`), so it follows the same-shaped precedent
`Locations` set for exactly this situation (a table added before its
stream, with no operational consumer of its own).

---

## 5. Landing Zone

**Bucket:** one per environment — `nyc311-warehouse-test` /
`nyc311-warehouse-prod`. `RemovalPolicy.RETAIN`, versioning off, SSE-S3,
`blockPublicAccess: BLOCK_ALL`, `enforceSSL: true`. A lifecycle rule
transitions `data/` to Glacier Instant Retrieval after 180 days.

**Layout — a single unified location per source, no separate raw/backfill
split:**

```
s3://nyc311-warehouse-<env>/
  data/
    order_events/dt=2026-09-05/<object>.parquet
    order_snapshots/dt=2026-09-05/...
    requests/dt=2026-09-05/...
  export-staging/                # transient — DynamoDB export landing zone during a rebuild (§10), cleared after replay
    <source>/<export-id>/...
  athena-results/                # Athena query output, own lifecycle: expire after 30d
  errors/
    order_events/<firehose-error-output>/...
```

Both the live Firehose stream and an on-demand rebuild (§10) land into the
same `data/<source>/` location — every source has exactly one Glue table,
one location, one set of files at any given time. `dt` (`YYYY-MM-DD`) is
the only partition level. A rebuild's replayed data lands under
`dt=<the date the rebuild ran>` — the true `occurred_at`/`created_at` of
each row remains a plain queryable column regardless of which physical
`dt=` folder it's stored under (see Appendix A.5 for why this tradeoff is
acceptable).

**File format: Firehose-native Parquet conversion.** Every genuinely
variable-shape blob (`OrderEvent.payload`, `Request.raw_payload`) is kept
as a `string` column, parsed with `json_extract` in SQL when needed —
every other field gets a real typed column.

---

## 6. Schema Evolution & Drift Detection

Firehose's Parquet converter and every Athena query read the **same**
Glue Data Catalog table entry (the `glue.CfnTable` defined in CDK, §7) —
there is exactly one schema definition, not two to keep in sync.

**`cdk/tests/warehouse/schemaSync.test.ts`** imports each source's zod
schema directly from `backend/models/` (`OrderSchema`, `RequestSchema`)
and asserts every top-level field name either appears as a `CfnTable`
column or is on a short, explicit, reviewed allowlist of intentionally-
opaque fields (`payload`, `raw_payload`). A field that's neither fails the
build with a message naming exactly which field and table needs a column
added — the same "a real assertion catches what a human might silently
get wrong" enforcement shape as the project's 10-custom-metric cap
(`1-data-ingestion.md` §8) and SNS filter-policy assertions
(`5-order-evaluation.md` §8).

This test catches an added field going unqueryable; it does **not** catch
a field renamed or removed (the `CfnTable` would just have a stale column)
— that stays a deliberate, human-driven migration.

---

## 7. Glue Catalog & Partitioning

**Deployment: CDK `glue.CfnDatabase` + `glue.CfnTable`** (L1 constructs,
`aws-cdk-lib/aws-glue`, no alpha package) — the schema is infrastructure,
versioned and reviewed alongside the Firehose that writes to it.

**Database:** `nyc311_warehouse_<env>`.

**Tables:**

| Table | Stable typed columns | Opaque columns | Also on every row |
|---|---|---|---|
| `order_events` | `order_id`, `sequence_number` (bigint), `event_type`, `stage`, `occurred_at` (timestamp), `actor` | `payload` (string, JSON) | `warehouse_ingested_at` (timestamp), `ingestion_source` (`STREAM`\|`REBUILD`) |
| `order_snapshots` | `order_id`, `current_stage`, `status`, `priority_tier`, `sla_deadline` (timestamp), `scheduled_start`/`_end`, `assigned_operator_id`, `case_id`, `request_id`, `location_id`, `last_event_sequence` (bigint), `created_at`/`updated_at` | `retry_counts` (string, JSON map) | `warehouse_ingested_at`, `ingestion_source`, `event_name` (`INSERT`\|`MODIFY`, null for `REBUILD` rows) |
| `requests` | `request_id`, `source`, `external_unique_key`, `location_id`, `complaint_type`, `descriptor`, `agency`, `status`, `created_at` | `raw_payload` (string, JSON) | `warehouse_ingested_at`, `ingestion_source`, `event_name` |
| `operator_events` (Leg 6) | `operator_id`, `sequence_number` (bigint), `event_type`, `occurred_at` (timestamp), `actor` | `payload` (string, JSON) | `warehouse_ingested_at`, `ingestion_source` |
| `operator_snapshots` (Leg 6) | `operator_id`, `name`, `status`, `current_activity`, `removal_requested_at` (timestamp), `start_datetime`/`end_datetime` (timestamp), `rate_per_hour` (double), `last_event_sequence` (bigint) | `current_location` (string, JSON `{lat,lng}` — **best guess**: kept opaque like `retry_counts` rather than split into `current_location_lat`/`_lng` typed columns, since nothing queries it yet; split it out if a geo query on Operators ever needs it) | `warehouse_ingested_at`, `ingestion_source` — **no `event_name`**, unlike `order_snapshots`/`requests`'s documented (but not actually wired — [#37](https://github.com/seththeeke/nyc-311/issues/37)) column; this table matches what's actually implemented |

**Partitioning: Athena partition projection** (`projection.enabled = true`,
`projection.dt.type = date`, `projection.dt.range = 2026-09-01,NOW`,
`storage.location.template = s3://…/data/<table>/dt=${dt}/`). No
`MSCK REPAIR`, no `ALTER TABLE ADD PARTITION`, no crawler.

---

## 8. Jobs & the Job Runner

> **Revised 2026-09-13 (Leg 8).** Jobs moved from checked-in `.sql` files
> + one shared static daily schedule to self-service records an admin
> creates through the app: a DynamoDB definition (name, cron cadence, a
> pointer to its SQL in S3) plus its own EventBridge Scheduler schedule,
> created/deleted at runtime rather than declared in CDK. The original
> design hit a real ceiling at just 4 registered jobs (Lambda's
> environment-variables payload limit — see Appendix A.11) and
> self-service authoring was wanted anyway, substantially closing the
> Open Items' "user-authored SQL jobs" item alongside Leg 7's console.

**A job is `{ name, cadence, sql }`.** The runner is still generic — it
does not know or care what any job's query returns. It resolves one
job's definition, runs the SQL, stores the resultset verbatim, and
appends it to that job's history table. Presentation-specific shaping
(which columns to chart, how to render) still lives entirely in the
consumer, never here.

### The registered jobs

These four shipped as checked-in `.sql` files originally (Legs 3.5/6);
Leg 8 backfilled them into the table+S3 model below and deleted the
files (see "Migration off `.sql` files" further down) — same SQL, same
names, same cadence, mechanism change only.

- **`order_volume_by_stage_7d`** — created-date × current-stage
  `COUNT(*)` over the trailing 7 days (`created_at >= current_date -
  interval '6' day`), from the latest `order_snapshots` row per
  `order_id`. Emits `(created_date, stage, order_count)`. Replaces
  Leg 3's `order_volume_by_stage` (a point-in-time stage snapshot).
  Surfaced on `/data`'s Results tab as a date × stage matrix.
- **`order_volume_by_borough`** — `COUNT(*)` per borough, latest
  `order_snapshots` row per `order_id` `LEFT JOIN` the latest `locations`
  row per `location_id` (= `bbl`); orders with no resolved `bbl` or no
  borough land in `'UNKNOWN'`. Emits `(borough, order_count)`. Unblocked
  once `Locations` was warehoused (§3, 2026-09-07).
- **`order_volume_by_stage_8w`** — like `order_volume_by_stage_7d` but
  bucketed by ISO creation-*week* over the trailing 8 weeks
  (`date_trunc('week', …)`), from the latest `order_snapshots` row per
  `order_id`. Emits `(week_start, stage, order_count)`. Every daily run
  recomputes all 8 weeks against current stages, so it stays a live
  trend rather than freezing old cohorts. This is the job the `/reports`
  page (§12) reads.
- **`operator_fleet_cost_to_date`** (Leg 6, 2026-09-13) — the latest
  `operator_snapshots` row per `operator_id`, `rate_per_hour × hours
  elapsed` from `start_datetime` to `end_datetime` (or now, for a still-
  active Operator). Emits `(operator_id, name, rate_per_hour,
  accumulated_cost)`, one row per Operator ever added, ordered by cost
  descending. This is `10-capacity-modeling-and-integration.md` §2.3's
  "all-time accumulated cost" job — no dedicated `/data` renderer built
  for it (falls back to `GenericResultTable`, same as any job with no
  per-job view), linked from the Capacity page rather than embedded there
  (§2.3's own "linked from (or embedded as a stat on)" language).

Adding a job is now a `POST /admin/warehouse/jobs` call through the
Admin SQL Query page (§12b) — no `.sql` file, no deploy.

### Job definitions — a second item type in `WarehouseJobRuns`

No new table — `10-capacity-modeling-and-integration.md`'s own framing
("a DDB entry in the existing table... the right partition key
strategy") is exactly the move here: a job *definition* is a second item
shape in the existing `WarehouseJobRuns-<env>` table (§9), discriminated
from a *run* row by `record_type` and by its `job_run_id`'s shape —
matching the same prefix-discrimination pattern `Orders`/`Operators`
already use (`#METADATA`/`EVENT#<n>`) for a different entity in one
table.

| Field | Definition row | Run row (§9, unchanged shape) |
|---|---|---|
| `job_run_id` (PK) | `` `DEF#<name>` `` — deterministic, not a ULID | a ULID |
| `record_type` | `"DEFINITION"` | `"RUN"` (new field; absent on pre-Leg-8 rows, treated as `"RUN"`) |
| `job_name` | the job's name (also the PK's suffix) | the job's name |
| `sql_s3_key` | `job-definitions/<name>.sql` in the warehouse bucket | — |
| `cadence_cron` | EventBridge Scheduler `cron(...)` expression | — |
| `schedule_name` | the schedule's physical name (needed to delete it) | — |
| `created_at` / `created_by` | timestamp / admin `user_id` | — |
| `gsi1pk` | `"JOB#DEFINITIONS"` — its own GSI1 partition, separate from runs' `"JOB#RUNS"` | `"JOB#RUNS"` (unchanged) |
| `gsi1sk` | `created_at` | `started_at` (unchanged) |
| `gsi2pk`/`gsi2sk` | absent (sparse — nothing sweeps a definition by status) | `status`/`started_at` (unchanged) |

`name` stays the one stable identity end to end, unchanged from before
Leg 8 — it keys the S3 SQL file, the DDB definition, the EventBridge
schedule's physical name, every `WarehouseJobRuns.job_name` it produces,
and the `job-results/job_name=<job>/...` S3 prefix + Glue partition
(§11). Chosen once at creation (`^[a-z0-9_]+$`, the same
`WarehouseJobSchema` regex as before), enforced unique via a conditional
`PutItem`; a name can't be renamed — changing one means delete + recreate.

### SQL storage: S3, not DynamoDB, not the repo

`s3://nyc311-warehouse-<env>/job-definitions/<name>.sql` — plain text,
no JSON envelope, so there's no parsing format to get wrong. Read once
per invocation by the runner; no synth-time manifest, no caching.

### Per-job EventBridge Scheduler schedules

One EventBridge Scheduler `Schedule` per job — the old shared daily
`Schedule` construct is gone — created/deleted **at runtime** by the
job-management API (§12b), not declared in CDK, since job identities
don't exist at synth time anymore:

- **Group:** `Nyc311WarehouseJobs-<Env>`, one CDK-declared
  `scheduler.CfnScheduleGroup` holding every dynamically-created job
  schedule — keeps `ListSchedules`/IAM resource patterns scoped to this
  feature.
- **Invocation role:** one CDK-declared IAM role
  (`Nyc311WarehouseJobScheduleRole-<Env>`), trusted by
  `scheduler.amazonaws.com`, granted `lambda:InvokeFunction` on
  `Nyc311WarehouseJobRunner-<Env>` only. Every dynamically-created
  schedule references this one role ARN, so the job-management API's own
  role needs `iam:PassRole` scoped to just this ARN — never a broad
  `iam:PassRole` on `*`.
- **Dead-letter queue:** a fresh `Nyc311WarehouseJobsDlq-<Env>` queue
  (plural "Jobs") under the new `Nyc311WarehouseJobScheduleGroup`
  construct — same purpose as the one the old single schedule used, but a
  genuinely new CloudFormation logical resource with a deliberately
  distinct physical name, alongside a likewise-renamed
  `Nyc311WarehouseJobsFailures-<Env>` topic and
  `Nyc311WarehouseJobsFailureAlarm-<Env>` alarm. **Revised 2026-09-14**:
  the first version of this construct reused the old singular-"Job"
  names outright; a real `Nyc311-Test` deploy proved that isn't just a
  "transient `AlreadyExists` risk" as originally assumed — CloudFormation's
  `AWS::EarlyValidation::ResourceExistenceCheck` hook refuses to even
  create a change set that both removes and adds a same-named resource,
  since it checks every `Add` before any `Remove` runs. Distinct names
  were the only fix; the old queue never carried state worth keeping
  anyway. Referenced by every dynamically-created schedule's target.
- **Target input:** `{"job_name": "<name>"}` — the runner's whole
  trigger contract now, replacing the old empty-object trigger.
- **Physical schedule name:** `Nyc311WarehouseJob-<name>-<Env>`.
- **Created/deleted by:** `@aws-sdk/client-scheduler`'s
  `CreateScheduleCommand`/`DeleteScheduleCommand`, called from
  `service/analytics/warehouseJobDefinitionService.ts` — a runtime SDK
  call, not a CDK construct.

### The runner: `Nyc311WarehouseJobRunner` (one Lambda, per-job schedules)

Still not Step Functions (Appendix A.10) — one query, seconds, no
orchestration value. Still one Lambda, `controller/analytics/
runWarehouseJobController.ts`, zod-parsed trigger (now `{job_name:
string}`, not empty) per `CLAUDE.md` §5.2.

Per invocation, now scoped to the one `job_name` its schedule fired with:

1. **Look up the definition** — `GetItem` `job_run_id = DEF#<job_name>`.
   Missing (deleted between the schedule firing and the Lambda starting
   — a narrow, accepted race) throws, logged; no `WarehouseJobRuns` row
   is written since there's no run to record yet.
2. **Fetch its SQL** — `s3:GetObject` on `sql_s3_key`.
3. **Retry decision** (§9, now per-job, not a cross-job sweep) — if
   *this* job's latest run `FAILED` with `retry_count < MAX_JOB_RETRIES`,
   this run is a `RETRY`; otherwise `SCHEDULED`. A job's own next fire is
   its retry opportunity now — there's no more "check every other job
   too" sweep, since every job already gets reconsidered on its own
   cadence, whatever that is.
4. Write a `RUNNING` `WarehouseJobRuns` row → `StartQueryExecution` /
   poll `GetQueryExecution` (capturing `Statistics` for §9) →
   `GetQueryResults` → build the resultset envelope (§11) and
   `s3:PutObject` it to
   `job-results/job_name=<job>/run_date=<date>/result.json` → update the
   row to `SUCCEEDED`/`FAILED`. **Unchanged from before Leg 8** — the
   only thing that changed is how the runner gets to "the SQL to run,"
   not what it does with it.

That single `result.json` per run is still *also* the history record:
one Glue table (`job_results`, §11) sits over the whole `job-results/`
prefix with partition projection on `(job_name, run_date)`, so "trend of
trends" is still a plain Athena query, no second write, no CTAS.

### Migration off `.sql` files (Leg 8, one-time)

`cdk/warehouse/sql/*.sql` — the 4 files that shipped through Legs
3.5/6 — were backfilled into this model and deleted from the repo.
`test-scripts/9-backfill-warehouse-jobs.py` (SQL text embedded in the
script itself, since the source files were about to be deleted) called
the new `POST /admin/warehouse/jobs` once per job against `Nyc311-Test`
(`--prod` for `Nyc311-Prod`), `cron(0 9 * * ? *)` for all four (daily at
09:00 UTC, matching the old `rate(1 day)` schedule's approximate fire
time) — then `readJobManifest()`/the `WAREHOUSE_JOBS` env var plumbing
and the `.sql` files themselves were deleted in the same change. Same
SQL text, same job names, same cadence — a mechanism change, not a
content change.

---

## 9. Job Run Tracking & Automatic Retry

**Table: `WarehouseJobRuns-<env>`** (plain `Dao<T>`, not event-sourced).
This section covers *run* rows only — §8 documents the *definition* item
type this same table also holds as of Leg 8.

| Field | Notes |
|---|---|
| `job_run_id` | PK. ULID for a run row; `` `DEF#<name>` `` is a *definition* row instead (§8) — `record_type` is what actually discriminates the two, this field's shape is a convenience, not the source of truth. |
| `record_type` | `"RUN"` (Leg 8) — absent on any row written before 2026-09-13, which every read path still treats as a run (nothing about the run shape changed). |
| `job_name` | e.g. `"order_volume_by_stage_7d"`, or `"REBUILD_ORDERS"`/`"REBUILD_REQUESTS"`/`"REBUILD_LOCATIONS"` for §10's on-demand rebuilds (keyed on the *source table*, not the warehouse table) — same table, one more `job_name` value. |
| `status` | `RUNNING` \| `SUCCEEDED` \| `FAILED`. |
| `trigger` | `SCHEDULED` \| `RETRY` \| `MANUAL` (the on-demand rebuild path, §10). |
| `started_at` / `completed_at` | `completed_at` nullable while `RUNNING`. |
| `execution_ref` | Athena `QueryExecutionId`, or the DynamoDB export ARN for a rebuild — opaque, interpreted per `job_name`. |
| `result_location` | Nullable. `s3://…/job-results/job_name=<job>/run_date=<date>/result.json` — where this run's resultset lives (§11). Null while `RUNNING` and for runs that produce no resultset. |
| `row_count` | Nullable. Number of rows in the resultset. |
| `error_message` | Nullable. |
| `retry_count` | `0` for an original run; a `RETRY` row carries `previous.retry_count + 1`. |
| `retried_from_job_run_id` | Nullable FK, links a `RETRY` row to what it's retrying. |
| `data_scanned_bytes` | Nullable — Athena's `Statistics.DataScannedInBytes`, query jobs only. |
| `engine_execution_time_ms` | Nullable — Athena's `Statistics.EngineExecutionTimeInMillis`. |
| `query_queue_time_ms` | Nullable — Athena's `Statistics.QueryQueueTimeInMillis`. |

**GSIs:**
- `gsi1-recent-runs` — `gsi1pk = "JOB#RUNS"` (fixed constant, run rows
  only — definition rows sit in the separate `"JOB#DEFINITIONS"`
  partition of this same index, §8), `gsi1sk = started_at`. Backs
  `/data`'s most-recent-first view.
- `gsi2-status` — `gsi2pk = status`, `gsi2sk = started_at`. Sparse —
  only run rows carry a `status`, so definition rows never appear here.

**Write path:** a `RUNNING` row at start, updated to `SUCCEEDED`/`FAILED`
at completion — every run recorded regardless of outcome. The tracking
write itself is wrapped in its own try/catch that only logs on failure,
never allowed to change the real outcome it's describing.

**Automatic retry — revised 2026-09-13 (Leg 8), now per-job, not a
cross-job sweep.** Before Leg 8, one shared daily invocation swept every
registered job looking for a `FAILED` prior run to retry, since one
invocation covered every job anyway. Now each job has its own schedule,
so each invocation just checks *itself*: at the start of a run, if that
job's most recent run `FAILED` with `retry_count < MAX_JOB_RETRIES`
(**3**), this run is a `RETRY` carrying `previous.retry_count + 1`;
otherwise it's `SCHEDULED`. A job's own next cadence fire **is** its
retry opportunity — a job on a sparse cadence (say, weekly) could take
up to 3 cycles to exhaust retries and stop auto-retrying, which is an
accepted, natural consequence of per-job cadence, not something worked
around. Once `MAX_JOB_RETRIES` is exhausted, a job stops being retried
automatically and shows as permanently failed on `/data` — no automatic
Case creation, unchanged from before.

---

## 10. On-Demand Rebuild

> **Revised 2026-09-08 (Leg 4).** Two designs were dropped before this
> one: the original `sns:Unsubscribe` pause (CDK-drift risk), and a
> replay-only "no wipe" variant (owner kept the wipe — the data isn't
> sensitive enough to complicate). The first *built* version replayed a
> whole source per Lambda invocation and immediately throttled Firehose
> and gutted the Test warehouse on first run. **As-built now:** wipe +
> rebuild, with rate-limiting in the state machine — the replay is a
> `Map` of small line-range chunks with a `Wait` before each, so it can
> run as long as it needs and no `PutRecordBatch` approaches the stream
> limit.

**`Nyc311WarehouseRebuild-<env>`** (`cdk/step-function/`) — the project's
only Step Functions state machine, manually triggered (never scheduled),
input `{}`, `TimeoutSeconds: 21600` (6 h). Wipes and re-derives **all
three sources'** warehoused data from a DynamoDB PITR export, **without
pausing live capture**.

**Sources run one at a time** (`orders → requests → locations` — *not*
`Parallel`: the account's Lambda-concurrency quota is small, and 3
concurrent replay chains once starved the API Lambdas into a `GET /data/jobs`
503). **Per source — the worker (`controller/data-archival/warehouseRebuildController.ts`
→ `service/analytics/warehouseRebuildService.ts`) is one Lambda,
dispatched on a `phase` field:**

1. **`StartExport-<source>`** (`CallAwsService`
   `dynamodb:exportTableToPointInTime`, `DYNAMODB_JSON`, `ExportTime` =
   `$$.Execution.StartTime`) → `export-staging/<source>/`.
2. **`WaitExport-<source>`** (`Wait` 30 s) → **`DescribeExport-<source>`**
   → **`ExportDone-<source>`** `Choice`: `IN_PROGRESS` loops, `FAILED` →
   `Fail`, `COMPLETED` → next.
3. **`Wipe-<source>`** (`phase: "wipe"`) — deletes `data/<table>/` for
   every warehouse table the source feeds (`orders` → `order_snapshots`
   + `order_events`), opens a `RUNNING` `REBUILD_<SOURCE>` job row, and
   from the export's `manifest-files.json` `itemCount`s returns the list
   of **chunks** `{ fileKey, start, count }` (`count` ≤ 3 000 rows).
4. **`ReplayChunks-<source>`** — a `Map` over those chunks,
   `maxConcurrency: 1`, each iteration **`PaceChunk-<source>`** (`Wait`
   3 s) → **`ReplayChunk-<source>`** (`phase: "replay"`): GetObject the
   file, take lines `[start, start+count)`, `unmarshall`, apply the
   **same relevance filter the live fan-out uses** (`sk === "#METADATA"`
   / `sk` starts `EVENT#` / `external_unique_key` present / `location_id`
   present), stamp `ingestion_source: "REBUILD"` +
   `warehouse_ingested_at: <exportTime>`, `firehose:PutRecordBatch`
   (≤500/call, exponential-backoff retry on transient throttle) onto the
   **same per-table Firehose the live pipeline uses**. ~3 k rows is a few
   MB — inside the stream's burst allowance — and the `Wait` sets the
   sustained rate, so a chunk never has to pace itself.
5. **`Finalize-<source>`** (`phase: "finalize"`) — sums the per-chunk
   counts, closes the job row `SUCCEEDED` (`row_count` = rows replayed),
   deletes the consumed `export-staging/<source>/`.
6. **Catch → `MarkFailed-<source>`** (`phase: "fail"`) — any wipe / replay
   / finalize error closes the job row `FAILED` with the cause, then the
   branch fails.

The transform Lambda respects the pre-set `ingestion_source` /
`warehouse_ingested_at` rather than re-stamping.

**No gap, no overlap staleness:** the stream keeps capturing changes from
`ExportTime` forward while the export runs. A replayed row carries
`warehouse_ingested_at = ExportTime`; a stream row for the same entity
written *after* the export carries a later timestamp. Every query resolves
"latest per entity" with `ROW_NUMBER() OVER (PARTITION BY <id> ORDER BY
warehouse_ingested_at DESC)`, so the newer stream row always wins.
`order_events` (append-only, no dedup) can carry a few duplicate rows for
events in the `[ExportTime, replay]` window — harmless: no job queries it
yet, and any future one dedups on `(order_id, sk)`.

**After the last source finalizes:** **`RecomputeJobs`** (`LambdaInvoke`
`Nyc311WarehouseJobRunner`) re-runs every job against the rebuilt data — a
fresh `run_date` resultset + history row — without waiting for the daily
schedule.

**Trigger: `test-scripts/5-warehouse-rebuild.py`** — looks up
`Nyc311WarehouseRebuildStateMachineArn` (a `CfnOutput`), `aws stepfunctions
start-execution --profile nyc311`, polls `describe-execution`, prints the
per-source replay counts. An operator running a script under the `nyc311`
profile — not a `/data` page action (§12). `--prod` targets `Nyc311-Prod`.

---

## 11. Serving Layer

No serving-specific database. A job's output is stored **once, verbatim**,
in two forms, and consumers read whichever fits:

### Per-run resultset — `result.json` in S3

`s3://nyc311-warehouse-<env>/job-results/job_name=<job>/run_date=<date>/result.json`,
written by the runner (§8), immutable except a same-day retry which
overwrites it. A self-describing envelope:

```jsonc
{
  "job_name": "order_volume_by_stage_7d",
  "job_run_id": "01M1Y3MPBM…",
  "run_date": "2026-09-07",
  "computed_at": "2026-09-07T14:16:36.410Z",
  "columns": [
    { "name": "created_date", "type": "varchar" },
    { "name": "stage",        "type": "varchar" },
    { "name": "order_count",  "type": "bigint" }
  ],
  "rows": [
    { "created_date": "2026-09-01", "stage": "SCHEDULE", "order_count": "8830" },
    { "created_date": "2026-09-01", "stage": "INGEST",   "order_count": "4918" }
  ]
}
```

`rows` are keyed objects (not positional), string-valued (Athena's native
output); `columns[].type` is the Athena type, so a consumer casts what it
needs. `GET /data/jobs/{name}/result` returns this body **unchanged** —
the API resolves `result_location` from the latest `SUCCEEDED`
`WarehouseJobRuns` row and does an `s3:GetObject`.

### Run history — Glue table `job_results`, Athena-queryable

One Glue table (`nyc311_warehouse_<env>.job_results`) sits over the whole
`job-results/` prefix, partition projection on `(job_name, run_date)`,
columns `job_run_id string`, `computed_at string`,
`columns array<struct<name:string,type:string>>`,
`rows array<map<string,string>>`. Every `result.json` the runner writes
*is* a history row — no second write. "Trend of trends" — how a given
day's numbers drifted across successive runs — is a plain query:

```sql
SELECT p.run_date, r['created_date'] AS created_date, r['stage'] AS stage,
       CAST(r['order_count'] AS bigint) AS order_count
FROM job_results p
CROSS JOIN UNNEST(p.rows) AS x(r)
WHERE p.job_name = 'order_volume_by_stage_7d' AND r['stage'] = 'SCHEDULE'
ORDER BY p.run_date, created_date
```

A job that wants clean typed columns for heavy analysis gets an Athena
`CREATE VIEW` (pure SQL, zero infra) — the "users add layers on top"
path. No API or UI over history yet (Open Items) — it's ad-hoc-queryable
substrate, decoupled from presentation until a feature needs it.

### Why this shape

The reporting substrate serves the whole app, not one dashboard: ad-hoc
queries, user-authored SQL jobs, features built on job output, Athena
views layered on top. A DynamoDB table pre-shaped for one chart
(`metric_view`/`dimension`/`value`) actively fought that — it was already
awkward for a 2-D result. Storing the resultset verbatim + a queryable
history table means adding a job is adding a `.sql` file, and consumers
own their own shaping. Full rationale: Appendix A.10.

---

## 12. The `/data` Page

A top-level route (`/data`, `PublicRoute` tier — the page itself is not
nested under `/monitoring/`, but it's reached from a "Data Warehouse"
tile on the Monitoring page, alongside the other read-only surfaces).
**Built and live against real routes (Legs 1–3, 2026-09-06).** Read-only;
backed by the GET routes below.

### Layout

A two-column grid (`lg:grid-cols-5`, stacks on mobile):

- **Left column (2/5) — Schema.** Each warehouse table renders as a
  native `<details>`, **collapsed by default** — the three table names
  stay visible, the ~15-column lists are opt-in. Live-read from Glue, not
  a checked-in copy (same "read live" principle `2-pipeline-monitoring.md`
  §4 set for pipeline status).
- **Right column (3/5) — a tab strip over a panel.** An AWS-console-style
  tab strip (`role="tablist"` — full-width bottom rule, a divider between
  options, an accent underline under the active tab) sitting flush on top
  of a `role="tabpanel"`, switching between:
  - **Jobs** — client-side filters (status / trigger / `job_name`
    substring) over a most-recent-first run table. Condensed rows (job
    name, status icon + screen-reader label, trigger badge, started,
    duration) expand to a detail row: run id, `execution_ref`, the retry
    chain (`↻ retry of <id>`, plus a "retries exhausted (max 3)" note
    once `retry_count >= MAX_JOB_RETRIES`), the query-performance stats,
    `result_location` / `row_count`, and the error message. A
    backfill/rebuild run is just another row, `job_name` starting
    `REBUILD_`.
  - **Performance** — the runs that carry Athena execution metrics
    (non-null `data_scanned_bytes` / `engine_execution_time_ms` /
    `query_queue_time_ms`), as a summary line (`N query runs · avg engine
    time · avg scanned`) over a per-run metrics table. Appendix A.8's
    time-series surface for later compaction/optimization work.
  - **Results** — the latest resultset of the selected job, rendered by a
    **per-job component keyed on `job_name`** (`order_volume_by_stage_7d`
    → a created-date × stage view). An unknown job falls back to a
    generic table dump off `columns` + `rows`. This is the only place
    job-specific presentation code lives; the job/warehouse layer knows
    nothing about it.

### The routes — response contracts

`GET /data/schema` — live `glue:GetTables` against the warehouse
database:

```jsonc
{ "tables": [
  { "table_name": "order_events",
    "columns": [ { "name": "order_id", "type": "string", "comment": null }, … ] }
] }
```

`GET /data/jobs` — `WarehouseJobRuns` via `gsi1-recent-runs`,
most-recent-first:

```jsonc
{ "jobRuns": [ {
  "job_run_id": "01J…", "job_name": "order_volume_by_stage_7d",
  "status": "SUCCEEDED",              // RUNNING | SUCCEEDED | FAILED
  "trigger": "SCHEDULED",             // SCHEDULED | RETRY | MANUAL
  "started_at": "2026-09-04T09:00:01.000Z",
  "completed_at": "2026-09-04T09:00:14.000Z",   // null while RUNNING
  "execution_ref": "…",                          // null | Athena QueryExecutionId | export ARN
  "result_location": "s3://…/job-results/job_name=order_volume_by_stage_7d/run_date=2026-09-04/result.json",
  "row_count": 21,                                // null while RUNNING
  "error_message": null,
  "retry_count": 0,
  "retried_from_job_run_id": null,
  "data_scanned_bytes": 485778,                  // null unless a completed Athena query
  "engine_execution_time_ms": 1332,              // null …
  "query_queue_time_ms": 56                       // null …
} ] }
```

`GET /data/jobs/{name}/result` — the latest `SUCCEEDED` run's resultset,
the §11 envelope, `s3:GetObject`'d and returned unchanged. `404` if the
job has never produced one.

### No write routes

No "retry this job" or "run a rebuild" button, no `POST` routes — see
Open Items. §10's rebuild stays script-triggered under the `nyc311`
profile. Every `/data` Lambda is asserted (CDK test) to carry no
`dynamodb:Put*`/`Update*`/`Delete*`, `athena:StartQueryExecution`, or
`states:StartExecution` — the "no writes" line holds at the IAM layer.

### Frontend files

`web-app/src/`:
- `models/warehouseSchema.ts`, `models/warehouseJobRun.ts`
  (+ `MAX_JOB_RETRIES = 3`, mirroring §9), `models/jobResult.ts` — the
  §11 envelope (`{ job_name, job_run_id, run_date, computed_at, columns,
  rows }`, `rows` is `Record<string, unknown>[]`).
- `services/warehouseDataService.ts` — `config.dataMode`-gated
  `Live`/`Mock`, like every other service. `getSchema()` / `getJobRuns()`
  / `getJobResult(name)`.
- `hooks/useWarehouseSchema.ts` (no poll), `useWarehouseJobRuns.ts`
  (30s poll), `useJobResult.ts` (30s poll).
- `components/data/`: `WarehouseSchemaView.tsx`, `DataViewTabs.tsx`
  (Jobs / Performance / Results), `JobsView.tsx`, `JobRunFilters.tsx`,
  `JobRunHistoryTable.tsx`, `PerformanceView.tsx`, `ResultsView.tsx`
  (dispatches on `job_name`), `jobRenderers/OrderVolumeByStage7dView.tsx`
  + `GenericResultTable.tsx`, `warehouseJobStatusVisuals.ts`,
  `formatters.ts`
- `components/pages/DataPage.tsx`, route `/data` in `routes/AppRoutes.tsx`
- `test-data/{warehouseSchema,warehouseJobRuns,jobResult}.ts`
- full mirrored tests under `web-app/tests/`.

`AnalyticsRollup` and its model/hook/view/fixture, plus the "Rollups"
tab, were removed in the 2026-09-07 rework (Appendix A.10).

### The `/reports` page

A second top-level route (`/reports`, `PublicRoute` tier), reached from a
"Reports" tile on the Monitoring page — the start of a **centralized
reporting surface** deliberately decoupled from the warehouse/job layer.
Adding a report is a backend concern; the page renders whatever
`GET /reports` returns. **Built and live 2026-09-07 (Build Checklist).**

`GET /reports` — for each *registered report job* (a small in-code list,
`backend/service/analytics/reportsService.ts`, today just
`order_volume_by_stage_8w`), the API resolves that job's latest
`SUCCEEDED` run, `s3:GetObject`'s its §11 `result.json`, and reshapes the
`(week, series, value)` resultset into a week-over-week trend — **no
Athena on the read path**. A report whose job has no result yet, or whose
resultset isn't a 3-column table, is silently omitted.

```jsonc
{ "reports": [ {
  "job_name": "order_volume_by_stage_8w",
  "title": "Order volume by stage — 8-week trend",
  "run_date": "2026-09-04", "computed_at": "2026-09-04T09:00:14.000Z",
  "week_column": "week_start", "series_column": "stage", "value_column": "order_count",
  "series": ["CLOSED", "EVALUATION", "INGEST", "SCHEDULE", "WORK"],   // sorted; the chart legend / matrix columns
  "weeks": [                                                          // oldest-first
    { "week": "2026-07-13", "values": { "CLOSED": 8210, "WORK": 41 } },  // values omits a series with no rows that week
    …
  ]
} ] }
```

Backend: `models/report.ts`, `service/analytics/reportsService.ts`
(built on `jobResultService`), `controller/web-api/getReportsController.ts`,
`cdk/warehouse/Nyc311ReportsApiLambda.ts` (`dynamodb:Query` +
`s3:GetObject` on `job-results/*`, nothing that writes), `/reports` route
on `Nyc311Api`. Frontend: `models/report.ts`, `services/reportsService.ts`,
`hooks/useReports.ts` (60s poll), `components/reports/ReportTrendTable.tsx`
(week × series matrix with totals), `components/pages/ReportsPage.tsx`,
`test-data/reports.ts`, full mirrored tests.

### 12a. Admin ad-hoc SQL console (Leg 7, 2026-09-13)

A new **SQL Query** tile on the Admin page (`/admin/query`, behind the
existing `AdminRoute`/JWT authorizer — same tier as Capacity/Scheduling),
addressing the narrow, single-admin-user slice of the "user-authored SQL
jobs / ad-hoc query API" Open Item: type a `SELECT`, run it, see the
result. Not the general version — no job CRUD, no persistence, no
multi-user story; that stays deferred.

**`POST /admin/warehouse/query`** — admin-authorized (`requireAdminUser`,
same as `/scheduling/run`). Body: `{ sql: string }`. Runs **synchronously**
— `StartQueryExecution` → poll `GetQueryExecution` → `GetQueryResults` — no
new async/polling API, matching this dataset's actual scale (queries
return in low single-digit seconds; §8's job runner does the exact same
poll loop for scheduled jobs). Capped at a lower wait than an unattended
job (**20 s**, Lambda timeout 25 s, under API Gateway HTTP API's fixed
29 s integration ceiling) — a query that hasn't finished by then returns a
timeout error asking the admin to narrow it, rather than the Lambda
getting killed mid-flight with no response at all.

```jsonc
// Request
{ "sql": "SELECT borough, COUNT(*) FROM locations GROUP BY borough" }

// Response (200)
{
  "columns": [ { "name": "borough", "type": "varchar" }, { "name": "_col1", "type": "bigint" } ],
  "rows": [ { "borough": "BROOKLYN", "_col1": "812" }, … ],
  "row_count": 5,
  "truncated": false,
  "data_scanned_bytes": 48213,
  "engine_execution_time_ms": 612
}
```

Same `columns`/`rows` shape as §11's job-result envelope (string-valued
rows, Athena types) deliberately — not literally reused (this isn't a job
run, has no `job_name`/`run_date`/`job_run_id`), but the frontend gets a
`QueryResultTable` component that's a close cousin of `GenericResultTable`
rather than inventing a new shape. Rows capped at **500** (`GetQueryResults`
`MaxResults`); `truncated: true` if the query had more.

**Read-only enforcement, three layers (the Open Item's flagged gaps,
addressed):**
- **Auth** — admin-only, same JWT authorizer as every other `/admin/*`
  route. There is exactly one admin user (`9-admin-auth-integration.md`),
  so "per-user auth" here means "gated behind the one admin identity that
  exists," not per-user quotas.
- **Query-text validation** — the controller rejects (`400`) anything
  whose first keyword isn't `SELECT`/`WITH`/`SHOW`/`DESCRIBE`/`EXPLAIN`. A
  fast, honest reject for an obvious mistake — not the real boundary.
- **IAM, the real boundary** — a dedicated Lambda role: `athena:StartQuery
  Execution`/`GetQueryExecution`/`GetQueryResults` scoped to a **new**,
  dedicated workgroup (below); `glue:GetDatabase`/`GetTable`/`GetPartitions`
  read-only on the one database (**no** `CreateTable`/`UpdateTable`);
  `s3:GetObject` on `data/*`; `s3:PutObject`/`GetObject`/`DeleteObject`
  scoped to `athena-results/adhoc/*` only, not the job runner's own output
  prefix. Even a query that slips past the text check (a Trino statement
  the naive prefix check doesn't recognize) has nowhere to write and
  nothing to alter — Athena `SELECT`/`WITH`/`SHOW`/`DESCRIBE` can't mutate
  DynamoDB or the operational tables regardless; this IAM is the same
  read-only shape §15 already uses for every `/data` Lambda.

**`Nyc311AdHocQueries-<Env>` — a second, dedicated Athena workgroup**
(not reusing `Nyc311Analytics-<Env>`, the scheduled job runner's
workgroup): an admin fat-fingering a runaway `CROSS JOIN` shouldn't be
able to affect the daily jobs' workgroup metrics or share their cutoff
budget. `bytesScannedCutoffPerQuery`: **1 GB** (tighter than the job
runner's 5 GB, even though real data volume needs neither) — this is the
"per-query cost controls" half of the Open Item that had nothing built
before today.

**Frontend:** `models/adHocQueryResult.ts` (the response envelope above),
`services/warehouseQueryService.ts` (`config.dataMode`-gated, matching
every other service — mock mode runs a few canned queries against
`test-data/` and errors on anything else), `hooks/useWarehouseQuery.ts`
(a mutation, not a poll — same shape as `useScheduling`),
`components/query/SqlQueryConsole.tsx` (a `<textarea>`, a Run button, and
a result area) + `components/query/QueryResultTable.tsx`,
`components/pages/AdminQueryPage.tsx`, a `SqlConsoleIcon` on the Admin
tile grid, fixtures, full mirrored tests. **Route moved 2026-09-13 (Leg
8):** `/admin/query` → `/admin/warehouse` once the page grew a Schema
tab and job authoring (§12b) — "Query" no longer describes everything
it does.

**Deliberately not built:** an `EXPLAIN`-only cost preview before
running, and CSV/JSON export of results — reasonable follow-ups, neither
blocking a working console. ~~Query history/saved queries~~ — Leg 8
below is exactly that, generalized into full job authoring rather than
a lighter-weight "save this one query" feature.

---

## 12b. Admin job authoring (Leg 8, 2026-09-13)

The Admin SQL console (§12a) grew into the one place to both run an
ad-hoc query and, if it's worth keeping, turn it into a real scheduled
job — no `.sql` file, no deploy. Same admin-only tier as everything else
under `/admin`.

### Layout — `/admin/warehouse`, three tabs

A tab strip (`role="tablist"`, same AWS-console visual convention
`/data` already established, §12) over one panel:

- **Schema** — the exact `WarehouseSchemaView` component `/data` already
  renders (§12), reused as-is here so an admin building a query doesn't
  need a second tab open on the public page to remember a column name.
- **Query** — §12a's console, unchanged, plus one new control: **Save as
  job**, enabled once a query has run successfully at least once. Opens
  a small form (name, cadence — the cron builder below) pre-filled with
  the query text already in the textarea, then calls `POST
  /admin/warehouse/jobs`.
- **Jobs** — the job-management surface: a list of job definitions (name,
  cadence in both raw-cron and human-readable form, created-by/at), a
  **New job** button (the same create form as "Save as job," empty),
  **Delete** per row (confirms, then calls `DELETE
  /admin/warehouse/jobs/{name}`), and, per job, its run history —
  reusing `JobRunHistoryTable`/`JobRunFilters` from `/data`'s existing
  Jobs tab (§12), scoped to that one `job_name` rather than showing every
  job's runs at once.

### The cron builder

A human-friendly front end over the one thing the backend actually
stores: an EventBridge Scheduler `cron(...)` string. Presets translate
directly to a cron expression — daily at a chosen `HH:MM`, hourly,
weekly on a chosen day at `HH:MM` — plus a raw-cron text field as an
escape hatch for anything the presets don't cover, with the resulting
`cron(...)` string shown live so the mapping is never a black box.
Validation is honest about where it lives: the builder can't fully
validate a hand-typed cron string client-side, so a malformed one is
caught server-side by EventBridge Scheduler's own `CreateSchedule` call
rejecting it — surfaced back to the form as a plain error, not silently
swallowed.

### The routes — request/response contracts

All under `/admin/warehouse/jobs`, admin-authorized, distinct from the
public, read-only `/data/*` (run history there stays public; job
*definitions* — names, cadences, and by extension what business logic
they encode — do not).

`POST /admin/warehouse/jobs` — body `{ name, cadence_cron, sql }`:

```jsonc
// Request
{
  "name": "order_volume_by_zip",
  "cadence_cron": "cron(0 9 * * ? *)",
  "sql": "SELECT ..."
}
// Response (201) — the created definition
{
  "job_name": "order_volume_by_zip",
  "cadence_cron": "cron(0 9 * * ? *)",
  "created_at": "2026-09-13T19:04:11.000Z",
  "created_by": "01ADMIN..."
}
```

Validates `name` against the same `^[a-z0-9_]+$` `WarehouseJobSchema`
regex as before, uniqueness via a conditional `PutItem`
(`attribute_not_exists`) — `409` on a name collision. Write order:
`s3:PutObject` the SQL first (an orphaned S3 object if a later step
fails is harmless), then the conditional DDB `PutItem` (the definitive
"this job exists" record), then `scheduler:CreateSchedule` last. If
`CreateSchedule` fails after the DDB write succeeds, the response is a
`502` naming the job as created-but-unscheduled — no automatic rollback
of the S3/DDB writes; the admin re-deletes and re-creates. Not a full
saga; accepted as a narrow, visible failure mode rather than
over-engineering an MVP self-service feature.

`DELETE /admin/warehouse/jobs/{name}` — `scheduler:DeleteSchedule`
(tolerates already-gone), `s3:DeleteObject` the SQL file, then the DDB
definition row. Every past `WarehouseJobRuns` row and `job-results/`
resultset for that job is left untouched (§8's "keep history" design
call) — `GET /data/jobs` and `/data`'s Jobs tab still show a deleted
job's history, `job_name` orphaned but not confusing (a `REBUILD_*`
job_name already works the same way with no live "job" behind it).

`GET /admin/warehouse/jobs` — every definition, `Query gsi1pk =
"JOB#DEFINITIONS"` (§8), most-recently-created first.

### IAM (§15's pattern, extended)

**Three separate Lambdas, one per route** — matching §2.1's Capacity
CRUD precedent (`Nyc311{Add,Remove,Get}CapacityApiLambda`), not one
bundled admin Lambda, so `GET` genuinely can't write anything:

- `Nyc311CreateWarehouseJobApiLambda` — the only Lambda in this doc with
  write access to a job's identity: `dynamodb:PutItem` on
  `WarehouseJobRuns`; `s3:PutObject` scoped to `job-definitions/*` only;
  `scheduler:CreateSchedule` scoped to the `Nyc311WarehouseJobs-<Env>`
  group; `iam:PassRole` scoped to **only**
  `Nyc311WarehouseJobScheduleRole-<Env>`'s one ARN — the narrowest a
  `PassRole` grant can be, since an unscoped one is a
  privilege-escalation path (this role can only ever invoke the one
  runner Lambda, so passing it grants nothing beyond what this feature
  already needs).
- `Nyc311DeleteWarehouseJobApiLambda` — `dynamodb:GetItem`/`DeleteItem`
  on `WarehouseJobRuns`; `s3:DeleteObject` scoped to `job-definitions/*`;
  `scheduler:DeleteSchedule` scoped to the schedule group. **No**
  `iam:PassRole` at all — deleting a schedule never needs it.
- `Nyc311ListWarehouseJobsApiLambda` — `dynamodb:Query` on
  `WarehouseJobRuns` only. No S3, no Scheduler, no `PassRole` — this
  route is genuinely read-only at the IAM layer, not just by convention.

All three also get `dynamodb:Query`/`GetItem` on `UsersTable`
(`requireAdminUser`). Asserted in CDK tests: none of the three has
`dynamodb:*`/`s3:*` access to any other table or prefix, `Delete`/`List`
have no `iam:PassRole` at all, and `Create`'s `PassRole` names exactly
one resource, never a wildcard.

### Frontend

`web-app/src/`: `models/{warehouseJobDefinition,cronSchedule}.ts`,
`services/warehouseJobDefinitionService.ts` (mock + live),
`hooks/{useWarehouseJobDefinitions,useCreateWarehouseJob,useDeleteWarehouseJob}.ts`,
`components/query/CronScheduleBuilder.tsx`,
`components/warehouseJobs/{JobDefinitionList,JobDefinitionForm}.tsx`
(reusing `JobRunHistoryTable`/`JobRunFilters` from `components/data/`
for the per-job history view), `components/pages/AdminWarehousePage.tsx`
at `/admin/warehouse` (replacing `AdminQueryPage.tsx`), a tab strip
matching `DataViewTabs`'s pattern, fixtures, full mirrored tests.

---

## 13. Repo Layout & `CLAUDE.md` Changes

```
cdk/
  warehouse/
    Nyc311WarehouseBucket.ts          # S3 landing-zone bucket
    Nyc311OrderEventsFirehose.ts      # SNS→Firehose, subscribes Nyc311OrderEventsTopic
    Nyc311OrderSnapshotsFirehose.ts   # SNS→Firehose, subscribes Nyc311OrderProjectionsTopic
    Nyc311RequestsFirehose.ts         # SNS→Firehose, subscribes Nyc311RequestEventsTopic
    Nyc311Warehouse{OrderEvents,OrderSnapshots,Requests,Locations}Firehose  # via one reusable Nyc311WarehouseFirehose, one instance per source
    Nyc311WarehouseCatalog.ts         # glue.CfnDatabase + glue.CfnTable ×7 (6 sources + job_results) + partition projection
    Nyc311AnalyticsWorkgroup.ts       # athena.CfnWorkGroup — the scheduled job runner's
    Nyc311AdHocQueryWorkgroup.ts      # athena.CfnWorkGroup — the admin console's, dedicated (§12a, Leg 7)
    Nyc311WarehouseJobRunnerLambda.ts # generic runner Lambda (§8/§9) — per-job schedule input as of Leg 8
    Nyc311WarehouseJobScheduleGroup.ts # scheduler.CfnScheduleGroup + the shared invocation IAM role (§8, Leg 8)
    Nyc311Warehouse{Schema,Jobs}ApiLambda.ts, Nyc311JobResultApiLambda.ts   # three /data read routes (§12)
    Nyc311ReportsApiLambda.ts         # GET /reports — the centralized reporting surface (§12)
    Nyc311WarehouseRebuildLambda.ts   # the rebuild worker Lambda (§10, Leg 4)
    Nyc311AdHocQueryApiLambda.ts      # POST /admin/warehouse/query (§12a, Leg 7)
    Nyc311{Create,Delete,List}WarehouseJobApiLambda.ts   # POST/DELETE/GET /admin/warehouse/jobs (§12b, Leg 8) — one Lambda per route, like Capacity CRUD
cdk/step-function/
  Nyc311WarehouseRebuildStateMachine.ts   # on-demand rebuild Step Functions (§10, Leg 4)
cdk/lambda/
  Nyc311LocationEventsTopic.ts, Nyc311LocationsFanOutLambda.ts   # §4, added 2026-09-07
  Nyc311Operator{Events,Projections}Topic.ts, Nyc311OperatorsStreamFanOutLambda.ts   # §4, Leg 6, 2026-09-13
```

**Removed in Leg 8 (2026-09-13):** `cdk/warehouse/sql/*.sql` (all four
files — backfilled into DDB+S3, §8's Migration note),
`Nyc311WarehouseJobSchedule.ts` (the single shared daily `Schedule` +
its own failure alarm/topic — replaced by
`Nyc311WarehouseJobScheduleGroup.ts` + per-job dynamic schedules;
the DLQ it declared is **kept**, now referenced by every dynamic
schedule instead of the one static one), and the `readJobManifest()`/
`WAREHOUSE_JOBS` env var plumbing inside
`Nyc311WarehouseJobRunnerLambda.ts`.

`backend/`: `models/{warehouseJobRun,jobResult,warehouseJob,warehouseJobTrigger,locationStreamEvent,operatorStreamEvent,report,warehouseRebuild,adHocQueryRequest,adHocQueryResult,warehouseJobDefinition}.ts`,
`dao/analytics/warehouseJobRunsDao.ts` (Leg 8 adds the definition-row
methods), `service/analytics/{warehouseJobRunnerService,
warehouseJobRunsService,warehouseSchemaService,jobResultService,reportsService,warehouseRebuildService,warehouseRecordTransformService,adHocQueryService,warehouseJobDefinitionService}.ts`,
`service/ingestion/{locationEventService,operatorEventService}.ts`,
`controller/analytics/runWarehouseJobController.ts`,
`controller/ingestion/{fanOutLocationEventsController,fanOutOperatorEventsController}.ts`,
`controller/data-archival/warehouseRebuildController.ts`,
`controller/web-api/get{WarehouseSchema,WarehouseJobRuns,JobResult,Reports}Controller.ts`,
`controller/web-api/runAdHocQueryController.ts` (Leg 7),
`controller/web-api/{createWarehouseJobController,deleteWarehouseJobController,listWarehouseJobsController}.ts`
(Leg 8). Rebuild adds `@aws-sdk/client-firehose`; Leg 8 adds
`@aws-sdk/client-scheduler`.
The 2026-09-07 rework deleted `dao/analytics/analyticsRollupsDao.ts`,
`models/analyticsRollup.ts`, `service/analytics/analyticsRollupsService.ts`,
`controller/web-api/getRollupsController.ts`, and the rollup-fold logic in
`warehouseJobRunnerService.ts`.

§4's Orders/Requests fan-out retrofits the two Lambdas that already exist
(renamed in place); the Locations and Operators fan-outs are genuinely new
Lambdas (there was no prior stream consumer on either table).

**`CLAUDE.md`:** §5.3's tree has `warehouse/` under `cdk/` and notes
`sql/` as a `.sql`-asset location (added in Leg 2/3). §5.2 documents the
`dao/analytics/` + `controller/analytics/` carve-out. `business-insights.md`
§3 still wants the "superseded for implementation detail" note (Build
Checklist).

---

## 14. Observability

**Revised 2026-09-08.** The originally-planned alarm suite (below) is
**deferred to the backlog** — while the project is scaled down for cost,
the interim observability story is the out-of-the-box CloudWatch metrics
plus the structured logs, no CloudWatch Alarms and no email routing:

- **Firehose** (×4) — `DeliveryToS3.DataFreshness`,
  `DeliveryToS3.Success`, `DeliveryToS3.Records`, and any object under
  `errors/<table>/` are all visible in the console with no setup.
- **Always-on Lambdas** (fan-out ×2, job runner) — `Errors` /
  `Invocations` / `Duration` / `IteratorAge` are covered by the public
  **Lambda-health tile** (`GET /lambda-metrics`, §12's sibling), which
  lists them in its monitored set.
- **Rebuild** (`Nyc311WarehouseRebuild-<env>` state machine +
  `Nyc311WarehouseRebuildWorker-<env>` Lambda) — a manual, rare tool, so
  its story is: SFN `ExecutionsFailed` (OOTB metric), the
  `REBUILD_<SOURCE>` `WarehouseJobRuns` row the worker writes
  (`RUNNING` → `SUCCEEDED`/`FAILED`, visible on `/data`), and the
  operator watching `describe-execution` from
  `test-scripts/5-warehouse-rebuild.py`.
- **Stuck `FAILED` jobs** — surfaced on the `/data` Jobs tab (the run row
  shows `FAILED` + "retries exhausted"), and in `WarehouseJobRuns` via
  `gsi2-status`.
- **`dao/service/controller` structured JSON logs** (`logger.ts`) — the
  same substrate a future `MetricFilter` would read; 7 of the 10-custom-
  metric cap remain unspent.

**Deferred to backlog** ([#25](https://github.com/seththeeke/nyc-311/issues/25)):
CloudWatch Alarms on Firehose `DataFreshness` / `errors/` (×4), SFN
`ExecutionsFailed` (rebuild machine), a stuck-`FAILED`-past-`MAX_JOB_RETRIES`
alarm, and `Nyc311LocationsFanOut` `Errors`/`IteratorAge` alarms — all
routing to `FAILURE_NOTIFICATION_EMAIL`. Pick this up when the project
scales back up.

---

## 15. IAM & Least Privilege

Every grant explicit, scoped to the specific resource ARN — never a
construct default:

- **Firehose delivery role (×3):** `s3:PutObject`/`GetBucketLocation`/
  `ListBucket` scoped to the bucket's `/data/*` and `/errors/*` prefixes;
  `glue:GetTable*` scoped to its one Glue table.
- **The two renamed fan-out Lambdas:** stream-read (unchanged, automatic)
  + `sns:Publish` on their own topic(s) only. Still no `dynamodb:*` write
  access — asserted absent in a CDK test.
- **Job-runner Lambda role:** `athena:StartQueryExecution`/
  `GetQueryExecution`/`GetQueryResults`/`StopQueryExecution` scoped to the
  one workgroup; `glue:GetDatabase`/`GetTable`/`GetPartitions` on the one
  database (read-only — the `job_results` table is CDK-declared, the
  runner never touches the catalog); `s3:GetObject` on `data/*` and
  (Leg 8) `job-definitions/*` — the runner reads a job's SQL from S3
  now, it doesn't ship in an env var — `s3:PutObject`/`GetObject` on
  `job-results/*`, `s3:PutObject`/`GetObject`/`DeleteObject` on
  `athena-results/*`; `dynamodb:GetItem`/`PutItem`/`Query` on
  `WarehouseJobRuns` (`GetItem` now also resolves a `DEF#<name>` row,
  §8 — **no** `DeleteItem`, the runner only ever reads a definition, it
  never manages one). No `AnalyticsRollups` — it no longer exists; no
  Glue writes.
- **Rebuild state machine role** (§10, as built): `dynamodb:ExportTableToPointInTime`
  on each source table + `dynamodb:DescribeExport` on `<table>/export/*`;
  `s3:PutObject`/`AbortMultipartUpload` on `export-staging/*` +
  `s3:GetBucketLocation`/`ListBucketMultipartUploads` on the bucket (the
  export writes as this role); `lambda:InvokeFunction` on the rebuild
  worker + the job runner. **No `sns:*`** — live capture is never touched.
- **Rebuild worker Lambda role:** `s3:ListBucket` on the bucket +
  `s3:GetObject` on `export-staging/*` + `s3:DeleteObject` on `data/*`;
  `firehose:PutRecordBatch` on the four delivery streams; `dynamodb:PutItem`
  on `WarehouseJobRuns`. No read of the operational tables — asserted in a
  CDK test.
- **`/data`'s three Lambdas — read-only, no exceptions:** schema route →
  `glue:GetTable`/`GetTables`/`GetDatabase` only; jobs route →
  `dynamodb:Query` on `WarehouseJobRuns` only; job-result route →
  `dynamodb:Query`/`GetItem` on `WarehouseJobRuns` (to resolve the latest
  `result_location`) + `s3:GetObject` on `job-results/*` only. **None gets
  any `dynamodb:Put*`/`Update*`/`Delete*`, `states:StartExecution`, or
  `athena:StartQueryExecution`** — asserted absent in a CDK test.
- **`Nyc311OperatorsStreamFanOutLambda`** (Leg 6): stream-read (automatic)
  + `sns:Publish` on `Nyc311OperatorEventsTopic`/`Nyc311OperatorProjectionsTopic`
  only. No `dynamodb:*` write access — asserted absent, same pattern as
  the other two fan-out Lambdas.
- **`Nyc311AdHocQueryApiLambda`** (§12a, Leg 7) — the one Lambda in this
  whole doc that runs a caller-supplied query string, so its IAM is the
  real enforcement boundary, not the text-prefix check: `athena:StartQuery
  Execution`/`GetQueryExecution`/`GetQueryResults` scoped to
  `Nyc311AdHocQueries-<Env>` **only** (not the job runner's workgroup);
  `glue:GetDatabase`/`GetTable`/`GetPartitions` read-only on the one
  database (**no** `CreateTable`/`UpdateTable`/`DeleteTable`); `s3:GetObject`
  on `data/*`; `s3:PutObject`/`GetObject`/`DeleteObject` scoped to
  `athena-results/adhoc/*` only (not the shared `athena-results/` root);
  `dynamodb:Query`/`GetItem` on `UsersTable` (`requireAdminUser`). **No
  write access to any operational table, no `job-results/*` access, no
  `glue:CreateTable`/`UpdateTable`/`DeleteTable`, no `dynamodb:Put*`/
  `Update*`/`Delete*`** — asserted absent in a CDK test, the same
  "asserted, not just written" pattern as every other `/data`-adjacent
  Lambda in this section.
- **`Nyc311{Create,Delete,List}WarehouseJobApiLambda`** (§12b, Leg 8) —
  three separate Lambdas, one per route, per §12b's own IAM section
  above: `Create` is the one Lambda in this whole doc that manages
  another Lambda's schedules, so its narrowly-scoped `iam:PassRole`
  (exactly `Nyc311WarehouseJobScheduleRole-<Env>`'s ARN, never a
  wildcard) is the thing to get right — an unscoped `PassRole` would let
  it hand a caller-chosen role to a caller-chosen schedule target.
  `Delete` gets no `PassRole` at all. `List` gets no `s3:*`/`scheduler:*`
  at all — it's read-only at the IAM layer, not just by convention. None
  of the three gets `athena:*`, `glue:*`, or access to
  `data/*`/`job-results/*`/`athena-results/*` — asserted absent in CDK
  tests.
- **`Nyc311WarehouseJobScheduleRole-<Env>`** (§8, Leg 8) — not a Lambda,
  the shared role every dynamically-created per-job `Schedule` assumes:
  trusted by `scheduler.amazonaws.com` only, granted `lambda:InvokeFunction`
  on `Nyc311WarehouseJobRunner-<Env>` **only** — it can invoke exactly
  one function and nothing else, so even a maximally-abused schedule
  created through the API above can't be pointed at any other resource.

---

## 16. Cost

| Component | Cost |
|---|---|
| S3 storage | Cents/month. |
| Kinesis Firehose (×4) | Low single-digit dollars/month at most; likely cents. |
| Athena | $5/TB scanned — a daily job over this data volume is effectively free. |
| Glue Data Catalog | Free tier covers this outright. |
| SNS (3 topics) | Free tier covers this outright. |
| `WarehouseJobRuns` (DynamoDB, on-demand) | Cents/month at most. |
| S3 `job-results/` (one small JSON + a Parquet partition per job per day) | Rounding error. |
| Lambda (job runner + the read routes) | Free tier covers it. |
| Step Functions (occasional rebuilds only, §10) | Rounding error. |
| EventBridge Scheduler (Leg 8 — one schedule per job, each firing on its own cadence) | Free tier is 14M invocations/month; this project is nowhere close. Free in practice regardless of how many jobs get self-service-created. |

**No new recurring infrastructure cost** — widening the two existing
fan-out Lambdas (§4) rather than adding a Kinesis Data Stream (Appendix
A.2) is the entire reason. Leg 8's per-job EventBridge Scheduler
schedules are the one addition to this list, and their free-tier
headroom is large enough that self-service job creation doesn't
introduce a cost concern worth tracking.

---

## 17. Testing

Same four-tier model (`testing-framework.md`):

- **Unit (Vitest, 90% per-file):** both widened fan-out
  controllers/services; the job runner (manifest iteration, per-job
  try/catch isolation, resultset-envelope build with string values +
  column types, `result.json` PutObject, `WarehouseJobRuns` lifecycle
  with `result_location`/`row_count`, retry decision, `MAX_JOB_RETRIES`
  cutoff) with the Athena/S3/DynamoDB clients mocked; `jobResultService`
  (resolve latest `result_location`, GetObject, parse, 404 path);
  `warehouseSchemaService`/`warehouseJobRunsService`; `reportsService`
  (the `(week, series, value)` pivot); `warehouseRebuildService`
  (`wipe`: prefix-wipe pagination + manifest→chunk math; `replay`:
  line-range slice + per-source filter/route + `REBUILD` stamp + Firehose
  backoff-retry; `finalize`: count sum + staging drop; `fail`: FAILED row
  ± fresh id) with S3/Firehose/DynamoDB mocked.
- **CDK assertions:** bucket config; Firehose ×4; `CfnDatabase` + the
  five `CfnTable`s (`order_events`/`order_snapshots`/`requests`/`locations`
  + `job_results`, partition-projection `parameters` asserted directly);
  §6's schema-drift test; `WarehouseJobRuns` key schema/GSIs; the runner
  Lambda's IAM (Athena + read-only `glue:Get*` + scoped `job-results/*`
  S3 write + `WarehouseJobRuns` — asserted **no** `glue:CreateTable`/
  `PutObject` outside `job-results/`); the schedule (`rate(1 day)` + DLQ
  + alarm); an explicit assertion that all `/data`/`/reports` Lambdas
  carry no write actions; the rebuild state machine (serial source
  chain, per-source export→poll→wipe→paced-`Map`→finalize, `MaxConcurrency: 1`,
  the `Wait` before each chunk, `itemSelector` capture, `Catch`→`MarkFailed`,
  `ExportTableToPointInTime`/`DescribeExport` IAM, S3 write on
  `export-staging/*`, ALL-level SFN logging) and the rebuild worker Lambda
  (asserted `firehose:PutRecordBatch` + scoped S3 + `dynamodb:PutItem`
  **only** — no operational-store read).
- **Real integration:** `test-scripts/4-warehouse-test.py` and (Leg 4)
  `5-warehouse-rebuild.py`. `GET /data/schema`, `/data/jobs`,
  `/data/jobs/{name}/result`, `/reports` are in
  `4-pipeline-integration-tests.md`'s real endpoint-coverage gate.
- **Frontend:** full mirrored Vitest/RTL suite for every `/data` and
  `/reports` model, service, hook, and component — including the per-job
  `ResultsView` dispatch and the `order_volume_by_stage_7d` renderer, the
  generic fallback table, and `ReportTrendTable`. `web-app`
  build/lint/`test:coverage` all green.

---

## 18. Naming Reference

| Piece | Name |
|---|---|
| S3 bucket | `nyc311-warehouse-<test\|prod>` |
| Glue database | `nyc311_warehouse_<test\|prod>` |
| Glue source tables | `order_events`, `order_snapshots`, `requests`, `locations`, `operator_events`, `operator_snapshots` (Leg 6) |
| Athena workgroups | `Nyc311Analytics-<Test\|Prod>` (scheduled jobs); `Nyc311AdHocQueries-<Test\|Prod>` (admin console, Leg 7, §12a) |
| Firehose (×6) | `Nyc311Warehouse-OrderEvents-<Test\|Prod>`, `…-OrderSnapshots-…`, `…-Requests-…`, `…-Locations-…`, `…-OperatorEvents-…`, `…-OperatorSnapshots-…` (Leg 6) |
| Fan-out Lambdas | `Nyc311OrdersStreamFanOutLambda`, `Nyc311RequestsFanOutLambda`, `Nyc311LocationsFanOutLambda`, `Nyc311OperatorsStreamFanOutLambda` (Leg 6) (+ their `…FanOutDlq-<Test\|Prod>` queues) |
| SNS topics | `Nyc311OrderProjectionsTopic`, `Nyc311RequestEventsTopic`, `Nyc311LocationEventsTopic`, `Nyc311OperatorEventsTopic`, `Nyc311OperatorProjectionsTopic` (Leg 6) (physical `Nyc311<Order Projections\|RequestEvents\|LocationEvents\|OperatorEvents\|OperatorProjections>-<Test\|Prod>`) |
| Job run history table (DynamoDB) | `WarehouseJobRuns-<Test\|Prod>` |
| Job result store (S3) | `s3://nyc311-warehouse-<test\|prod>/job-results/job_name=<job>/run_date=<date>/result.json` |
| Job history table (Glue/Athena) | `nyc311_warehouse_<test\|prod>.job_results` (one table, `rows array<map<string,string>>`, over the whole `job-results/` prefix) |
| Rebuild state machine / worker Lambda | `Nyc311WarehouseRebuild-<Test\|Prod>`, `Nyc311WarehouseRebuildWorker-<Test\|Prod>` (Leg 4); ARN in the `Nyc311WarehouseRebuildStateMachineArn` stack output; export staging under `s3://…/export-staging/<source>/`. **Not extended to `Operators` in Leg 6** — the rebuild covers `orders`/`requests`/`locations` only; adding `operators` is future work (§10/Open Items), not a blocker to live capture + the job. |
| Job runner Lambda | `Nyc311WarehouseJobRunner-<Test\|Prod>` — per-job `Schedule`s trigger it now, no single named schedule (Leg 8) |
| Job schedule group / invocation role | `Nyc311WarehouseJobs-<Test\|Prod>` (`scheduler.CfnScheduleGroup`); `Nyc311WarehouseJobScheduleRole-<Test\|Prod>` (Leg 8, §8) |
| Per-job schedule | `Nyc311WarehouseJob-<name>-<Test\|Prod>`, one per job definition, created/deleted at runtime (Leg 8, §8) |
| Reports API Lambda | `Nyc311ReportsApi-<Test\|Prod>` |
| Ad-hoc query API Lambda | `Nyc311AdHocQueryApi-<Test\|Prod>` (Leg 7, §12a) |
| Admin job-management API Lambda | `Nyc311AdminWarehouseJobsApi-<Test\|Prod>` (Leg 8, §12b) |
| Job SQL storage (S3) | `s3://nyc311-warehouse-<test\|prod>/job-definitions/<name>.sql` (Leg 8, §8) — replaces the checked-in `cdk/warehouse/sql/*.sql` files, deleted in the same change |
| `/data` routes | `GET /data/schema`, `GET /data/jobs`, `GET /data/jobs/{name}/result` |
| `/reports` route | `GET /reports` (§12) |
| Ad-hoc query route | `POST /admin/warehouse/query`, admin-authorized (§12a, Leg 7) |
| Admin job-management routes | `POST`/`GET`/`DELETE /admin/warehouse/jobs[/{name}]`, admin-authorized (§12b, Leg 8) |
| `/data` frontend | `web-app/src/models/{warehouseSchema,warehouseJobRun,jobResult}.ts`, `services/warehouseDataService.ts`, `hooks/{useWarehouseSchema,useWarehouseJobRuns,useJobResult}.ts`, `components/data/*`, `components/pages/DataPage.tsx`, route `/data` (§12) |
| `/reports` frontend | `web-app/src/models/report.ts`, `services/reportsService.ts`, `hooks/useReports.ts`, `components/reports/ReportTrendTable.tsx`, `components/pages/ReportsPage.tsx`, route `/reports` (§12) |
| Admin Data Warehouse frontend | `web-app/src/models/{adHocQueryResult,warehouseJobDefinition,cronSchedule}.ts`, `services/{warehouseQueryService,warehouseJobDefinitionService}.ts`, `hooks/{useWarehouseQuery,useWarehouseJobDefinitions,useCreateWarehouseJob,useDeleteWarehouseJob}.ts`, `components/{query,warehouseJobs}/*`, `components/pages/AdminWarehousePage.tsx`, route `/admin/warehouse` (§12a/§12b, Legs 7/8 — supersedes the Leg 7 `/admin/query` route/page name) |
| Integration scripts | `test-scripts/4-warehouse-test.py`, `test-scripts/5-warehouse-rebuild.py` (Leg 4), `test-scripts/9-backfill-warehouse-jobs.py` (Leg 8, one-time) |

---

## Build Checklist

Legs 1–3 shipped 2026-09-06; Leg 3.5 (reporting-substrate rework) +
Monitoring tile 2026-09-07; Locations + Reports 2026-09-07 (verified
2026-09-08); Leg 4 (on-demand rebuild) shipped 2026-09-08, verified
2026-09-09. Leg 5's alarm suite is deferred to
[#25](https://github.com/seththeeke/nyc-311/issues/25). **Leg 6
(`Operators` joins the pipeline, §2.3's cost job), Leg 7 (admin ad-hoc
SQL console, §12a), and Leg 8 (self-service job authoring — jobs are no
longer `.sql` files, §12b/Appendix A.11) all landed 2026-09-13** — see
their sections below. Jobs no longer "land as the domain grows" via a
checked-in file (biz-intel-agent, [#24](https://github.com/seththeeke/nyc-311/issues/24),
now owns *authoring good jobs*, not the mechanics of registering one —
Leg 8 already solved the mechanics).
Tracked as legs, roughly in dependency order.

### Frontend — `/data` page

- [x] Models, mock service, hooks, components, page, route, fixtures, full
      mirrored tests — **done 2026-09-05**; `config.dataMode`-gated and
      live against real routes **2026-09-06** (§12).
- [x] `GET /data/{schema,jobs}` in `4-pipeline-integration-tests.md`'s
      endpoint-coverage report — **done 2026-09-06** (the `/data/rollups`
      entry is replaced by `/data/jobs/{name}/result` in Leg 3.5).

### Leg 3.5 — reporting-substrate rework (§8/§11) — **shipped 2026-09-07**

Job output is an immutable resultset in S3 + an Athena-queryable history
table; the DynamoDB EAV serving table (`AnalyticsRollups`) is gone.

- [x] **Deleted** `AnalyticsRollups` (CDK `TableV2` + tests), its DAO,
      model, service, `getRollupsController` + `Nyc311RollupsApiLambda` +
      the `/data/rollups` route, and the rollup-fold loop. Web-app:
      `analyticsRollup` model/hook/`RollupsView`/fixture + the "Rollups"
      tab. `/data/rollups` dropped from `KNOWN_ROUTES`.
- [x] `cdk/warehouse/sql/order_volume_by_stage_7d.sql` — created-date ×
      current-stage `COUNT(*)`, trailing 7 days by `created_at`.
- [x] Generic runner: iterate the `WAREHOUSE_JOBS` manifest (built from
      `sql/` at synth), per job (isolated try/catch) → run Athena → build
      the §11 envelope (string values + column types from `ResultSetMetadata`)
      → `PutObject` `result.json` → record the run with `result_location`
      + `row_count`. Runner role: scoped `job-results/*` S3 write, no Glue
      writes.
- [x] `Nyc311WarehouseCatalog`: CDK-declared `job_results` Glue table
      (JSON, `rows array<map<string,string>>`, injected `job_name` + date
      `run_date` projection) over `job-results/`.
- [x] `WarehouseJobRuns` model + DAO: `result_location` + `row_count`
      (`.nullish()` — pre-Leg-3.5 rows still parse),
      `getLatestSucceededRunForJob`.
- [x] `jobResultService` + `getJobResultController` +
      `Nyc311JobResultApiLambda` + `GET /data/jobs/{name}/result`
      (read-only IAM asserted).
- [x] Web-app: `jobResult` model/hook, `warehouseDataService.getJobResult()`,
      `ResultsView` + `OrderVolumeByStage7dView` (date × stage matrix) +
      `GenericResultTable`, "Results" tab, fixtures, full mirrored tests.
- [x] `KNOWN_ROUTES` + `jobResultApi.integration.test.ts`;
      `warehouseSchemaApi.integration.test` updated for the 4th table.
- [x] **Verified in `Nyc311-Test`** (2026-09-07): forced runner invoke →
      SUCCEEDED, `result.json` in S3 (envelope, string values), returned
      verbatim by `GET /data/jobs/{name}/result`; `job_results` queryable
      via `CROSS JOIN UNNEST(rows)`; `GET /data/jobs` loads legacy rows;
      `GET /data/schema` lists 4 tables; `/data` Results tab renders the
      2026-09-06/07 × INGEST/SCHEDULE matrix; Data Warehouse tile on
      `/monitoring`.
- **Follow-up (not blocking):** the pre-Leg-3.5 `WarehouseJobRuns` rows
  still show under the old `ORDER_VOLUME_BY_STAGE` job_name on `/data`;
  harmless, they age out of the read window. `AnalyticsRollups-{Test,Prod}`
  DynamoDB tables are orphaned (RETAIN policy) — delete manually if wanted.

### Data Warehouse tile

- [x] Moved the `/data` entry point off the home page into a "Data
      Warehouse" tile on `/monitoring` (2026-09-07).

### Locations → warehouse (§3/§4, 2026-09-07)

`Locations` data now exists in the tables, so it joins the pipeline —
unblocking the borough job.

- [x] Stream on `Locations-{Test,Prod}` (non-replacing update);
      `Nyc311LocationEventsTopic` + `Nyc311LocationsFanOutLambda`
      (`INSERT`-only, `sns:Publish` only); 4th `Nyc311WarehouseFirehose` →
      `locations` Glue table; `warehouseTableSchemas` + `schemaSync` entry;
      `LocationsFanOut` in the lambda-health monitored list; stack wiring.
      Shipped `64e8baf` (2026-09-07).
- [x] `cdk/warehouse/sql/order_volume_by_borough.sql` — `order_snapshots
      LEFT JOIN locations` per borough, `'UNKNOWN'` bucket for unresolved.
- [x] **Verified in `Nyc311-Test`** (2026-09-08, organic data): the
      Locations fan-out ran 1,892×/24h with no errors; the `locations`
      Glue table holds 2,530 rows across all 5 boroughs, Athena-queryable
      (`warehouse_ingested_at` from 2026-09-08). The 2026-09-08 scheduled
      run produced an `order_volume_by_borough` resultset (6 rows) — the
      `LEFT JOIN locations` resolves real boroughs, with `UNKNOWN` for
      orders whose location pre-dates the LATEST stream cursor (self-heals
      as new data lands). `/data` lists `locations` in the schema.
- **Deferred to Leg 5:** a dedicated CloudWatch email alarm on the
      Locations fan-out Lambda (it's in the lambda-health tile for now).

### Reports — `/reports` page + `GET /reports` (§12, 2026-09-07)

The centralized reporting surface, decoupled from the warehouse/job layer.

- [x] `cdk/warehouse/sql/order_volume_by_stage_8w.sql` — creation-week ×
      stage `COUNT(*)` over the trailing 8 ISO weeks, recomputed every run.
- [x] `models/report.ts` + `service/analytics/reportsService.ts` (built on
      `jobResultService`, registered-report list) + `getReportsController`
      + `Nyc311ReportsApiLambda` + `GET /reports` route (read-only IAM
      asserted); `ReportsApi` in the lambda-health monitored list;
      `KNOWN_ROUTES` + `reportsApi.integration.test.ts`.
- [x] Web-app: `report` model/service/`useReports` hook,
      `ReportTrendTable` (week × series matrix with totals), `ReportsPage`
      at `/reports`, "Reports" tile on `/monitoring`, fixtures, full
      mirrored tests. Monitoring-tile icons extracted to
      `components/monitoring/MonitoringTileIcons.tsx` (200-line cap).
- [x] **Verified in `Nyc311-Test`** (2026-09-08, organic data): the
      scheduled run produced an `order_volume_by_stage_8w` resultset
      (5 rows, `(week_start, stage, order_count)`); `GET /reports` returns
      the pivoted week-over-week trend (series `[EXECUTE, INGEST,
      SCHEDULE]`, weeks oldest-first); `/reports` renders the
      `ReportTrendTable` matrix with totals; the "Reports" tile on
      `/monitoring` navigates there. Page served from `test.boroughsim.com`
      calls `api.test.boroughsim.com` with no CORS/console errors.
- **Prod note (not a warehouse defect):** `Nyc311-Prod` has had zero
      ingestion activity — 0 poller runs, 0 orders, empty warehouse — so
      all three jobs run `SUCCEEDED` with 0 rows there and `GET /reports`
      returns a well-formed empty report (`/reports` shows its empty
      state). The pre-existing `order_volume_by_stage_7d` job is 0 rows in
      Prod too; Prod's ingestion never having run is a separate issue.

### Leg 1 — change capture (§4) — **shipped 2026-09-06**

- [x] Rename `Nyc311OrderEventFanOutLambda` → `Nyc311OrdersStreamFanOutLambda`;
      widen it to route `#METADATA` → new `Nyc311OrderProjectionsTopic`.
- [x] Rename `Nyc311OrderFanOutLambda` → `Nyc311RequestsFanOutLambda`;
      widen it to publish every real Request row to new
      `Nyc311RequestEventsTopic` (with `event_name` attribute); ingestion
      queue moved onto a filtered SNS subscription (`{event_name: ["INSERT"]}`).
- [x] Unit + CDK assertion tests for both.
- [x] Verified in `Nyc311-Test`: request promotion / order evaluation
      unchanged. (Uncovered a pre-existing `RequestDao.updateRequestStatus`
      reserved-keyword bug in the process — fixed in the same loop.)

### Leg 2 — landing zone + catalog (§5–§7) — **shipped 2026-09-06**

- [x] `cdk/warehouse/Nyc311WarehouseBucket.ts` (§5 prefix layout).
- [x] Three Firehoses, JSON→Parquet against the Glue tables, subscribed to
      the three topics. One shared transform Lambda stamps
      `warehouse_ingested_at` / `ingestion_source` and stringifies opaque
      fields.
- [x] `Nyc311WarehouseCatalog.ts` — Glue database + three `CfnTable`s +
      Athena partition projection on `dt`.
- [x] `Nyc311AnalyticsWorkgroup.ts`.
- [x] `cdk/tests/warehouse/schemaSync.test.ts` — drift-detection test.
- [x] `CLAUDE.md` §5.3 tree: `cdk/warehouse/` added.
- [x] Verified in `Nyc311-Test`: a synthetic OrderEvent landed as Parquet
      in `nyc311_warehouse_test.order_events`, Athena-queryable,
      `ingestion_source = 'STREAM'` (`test-scripts/4-warehouse-test.py`).
- **Deviation:** timestamp-ish Glue columns are typed `string`, not
  `timestamp` — the Firehose Parquet converter rejects ISO-8601 strings
  for a `timestamp` column. Flagged and accepted.

### Leg 3 — job runner + tracking + serving (§8–§9, §11) — **shipped 2026-09-06, serving layer superseded by Leg 3.5**

- [x] `WarehouseJobRuns` table + `dao/analytics/warehouseJobRunsDao` +
      service (RUNNING→SUCCEEDED/FAILED write lifecycle, retry decision,
      `MAX_JOB_RETRIES` cutoff).
- [x] `AnalyticsRollups` table + `dao/analytics/analyticsRollupsDao` +
      the fold-back logic in `warehouseJobRunnerService`.
- [x] `Nyc311WarehouseJobRunnerLambda` — EventBridge Scheduler
      (`rate(1 day)`) → **one Lambda** (not Step Functions — the query
      scans KB and returns in seconds; Leg 4's rebuild is where SFN earns
      its keep) → Athena → fold rows into `AnalyticsRollups` → record the
      run. DLQ + single-failure CloudWatch alarm.
- [x] `cdk/warehouse/sql/order_volume_by_stage.sql` — the sample job is
      **`order_volume_by_stage`** (count of Orders per `current_stage` from
      the latest `order_snapshots` row per order), chosen over
      `order_volume_by_borough` so it needs no `Locations` join and runs
      today. `§8`'s borough job is deferred with the `Locations` pipeline.
- [x] `GET /data/schema` + `GET /data/jobs` + `GET /data/rollups` Lambdas
      and routes — read-only IAM (`glue:Get*` / `dynamodb:Query` only),
      asserted no write actions in the CDK tests.
- [x] `CLAUDE.md` §5.2: documented the `dao/analytics/` +
      `controller/analytics/` carve-out.

### Leg 4 — on-demand rebuild (§10) — **built 2026-09-08**

Design: wipe + rebuild, all three sources, **rate-limiting in the state
machine** — the replay is a `Map` of ≤3 000-row line-range chunks,
`maxConcurrency: 1`, a `Wait` before each. (First built version replayed a
whole source per invocation, throttled Firehose, and gutted the Test
warehouse on its first real run — hence the chunked redesign.)

- [x] `cdk/step-function/Nyc311WarehouseRebuildStateMachine.ts` — the
      project's only SFN. Sources chained **serially** (`orders → requests
      → locations`, not `Parallel` — Lambda-concurrency quota): each
      `StartExport` → poll `DescribeExport` → `Wipe` → `Map`(`PaceChunk`
      `Wait` → `ReplayChunk`, item via `itemSelector`) → `Finalize`,
      `Catch` → `MarkFailed`; then `RecomputeJobs`. `TimeoutSeconds: 21600`.
- [x] `cdk/warehouse/Nyc311WarehouseRebuildLambda.ts` +
      `backend/{models/warehouseRebuild,service/analytics/warehouseRebuildService,
      controller/data-archival/warehouseRebuildController}.ts` — one
      Lambda, `phase`-dispatched (`wipe` → `replay` ×N → `finalize`;
      `fail` = Catch). `@aws-sdk/client-firehose` added.
- [x] `warehouseRecordTransformService` respects a pre-set
      `ingestion_source` / `warehouse_ingested_at`.
- [x] `Nyc311WarehouseRebuildStateMachineArn` `CfnOutput`;
      `test-scripts/5-warehouse-rebuild.py` (`--prod` flag).
- [x] Full unit + CDK assertion tests (worker IAM asserts no operational-
      store read). `backend`/`cdk` build + lint + test:coverage green.
- [x] **Verified in `Nyc311-Test`** (2026-09-09). Two runtime bugs found
      and fixed first: the initial "whole source per invocation" replay
      burst-throttled Firehose and gutted the warehouse (→ chunked +
      `Wait`-paced), and `$$.Map.Item.Value` referenced deep in the
      processor didn't resolve (→ `itemSelector`). A third fix landed
      after: sources chained serially, not `Parallel`, after 3 concurrent
      replay chains threw a `GET /data/jobs` 503 (Lambda-concurrency
      throttle) during a pipeline integration run. Final run: `SUCCEEDED`
      in ~90 min — `REBUILD_ORDERS` 967 874 rows, `REBUILD_REQUESTS`
      294 408, `REBUILD_LOCATIONS` 75 289; `data/<table>/` repopulated
      (~185 MB); `export-staging/` auto-cleaned; `RecomputeJobs` produced
      3 fresh resultsets (~12 MB scanned each); `GET /reports` returns the
      trend.

### Leg 5 — observability (§14)

- [x] **Interim story (2026-09-08):** OOTB CloudWatch metrics (Firehose
      `DataFreshness`/`errors/`, Lambda `Errors`/`IteratorAge` via the
      Lambda-health tile, SFN `ExecutionsFailed`) + structured logs. No
      CloudWatch Alarms, no email routing while the project is scaled
      down.
- [ ] **Deferred to [#25](https://github.com/seththeeke/nyc-311/issues/25):**
      the full alarm suite (Firehose freshness/errors ×4, SFN
      `ExecutionsFailed`, stuck-`FAILED` job, `Nyc311LocationsFanOut`
      `Errors`/`IteratorAge`) → `FAILURE_NOTIFICATION_EMAIL`. Build when
      scaling back up.

### Leg 6 — `Operators` joins the pipeline (§3/§4/§7/§8) — **built 2026-09-13**

- [x] `cdk/data/OperatorsTable.ts` — enable `dynamoStream:
      StreamViewType.NEW_AND_OLD_IMAGES` (non-replacing update, same as
      `Locations`/`Requests` before it).
- [x] `cdk/lambda/Nyc311OperatorEventsTopic.ts`,
      `Nyc311OperatorProjectionsTopic.ts` (mirrors
      `Nyc311LocationEventsTopic.ts`).
- [x] `cdk/lambda/Nyc311OperatorsStreamFanOutLambda.ts` — routes by `sk`
      (`Orders`-style dual-topic, not `Locations`-style single-topic; §4).
- [x] `backend/models/operatorStreamEvent.ts`,
      `service/ingestion/operatorEventService.ts`,
      `controller/ingestion/fanOutOperatorEventsController.ts`.
- [x] `cdk/warehouse/warehouseTableSchemas.ts` — `operator_events` +
      `operator_snapshots` entries (§7); `Nyc311WarehouseCatalog` picks
      them up automatically. `current_location` kept opaque (best guess,
      flagged in §7's table); `event_name` deliberately **not** added
      (found and logged [#37](https://github.com/seththeeke/nyc-311/issues/37)
      that `order_snapshots`/`requests`' documented `event_name` column
      never actually reaches the warehouse — this table matches real
      behavior instead of propagating that gap).
- [x] Two more `Nyc311WarehouseFirehose` instances in `Nyc311Stack.ts`.
- [x] `cdk/tests/warehouse/schemaSync.test.ts` — add both tables to
      `TABLE_TO_MODEL`; the field-extraction regex was also widened to
      catch a field typed from an imported schema (`GpsLocationSchema`),
      not just a literal `z.` call — `current_location` would otherwise
      have been invisible to the drift check.
- [x] `Nyc311OperatorsStreamFanOutLambda` added to the lambda-health
      monitored list (`MONITORED_LAMBDA_OPERATORS_FAN_OUT`).
- [x] `cdk/warehouse/sql/operator_fleet_cost_to_date.sql` — §8's new job.
- [x] IAM: fan-out Lambda publish-only on its two topics, no
      `dynamodb:*` write — asserted absent in a CDK test (§15).
- [x] **Not extended:** Leg 4's rebuild state machine stays
      `orders`/`requests`/`locations` only — adding `operators` as a 4th
      source is future work (Open Items), not part of this leg.
- [x] `backend`/`cdk` build/lint/`test:coverage` all green (90%+ per
      file) — 2026-09-13.
- [ ] **Not yet deployed to `Nyc311-Test`/verified live** — pending push
      + deploy + the same "seed an Operator, watch it flow through" check
      as Leg 3's original live verification.

### Leg 7 — admin ad-hoc SQL console (§12a) — **built 2026-09-13**

- [x] `cdk/warehouse/Nyc311AdHocQueryWorkgroup.ts` — dedicated Athena
      workgroup, `bytesScannedCutoffPerQuery` 1 GB, own
      `athena-results/adhoc/` output prefix.
- [x] `backend/models/{adHocQueryRequest,adHocQueryResult}.ts`,
      `service/analytics/adHocQueryService.ts` (Athena start/poll/results,
      20 s cap, 500ms poll interval — mirrors
      `warehouseJobRunnerService.ts`'s poll loop at a shorter timeout),
      `controller/web-api/runAdHocQueryController.ts` (`requireAdminUser`
      + read-only statement-prefix check, `ValidationError` → `400`).
- [x] `cdk/warehouse/Nyc311AdHocQueryApiLambda.ts` — least-privilege IAM
      per §12a/§15 (scoped to its own workgroup + `athena-results/adhoc/*`,
      no Glue writes, no operational-table access besides `UsersTable`
      for `requireAdminUser`).
- [x] `POST /admin/warehouse/query` on `Nyc311Api`, admin-authorized —
      15th route, `/data`'s "declares exactly N routes" test updated.
- [x] Frontend: `models/adHocQueryResult.ts`,
      `services/warehouseQueryService.ts` (mock + live),
      `hooks/useWarehouseQuery.ts`,
      `components/query/{SqlQueryConsole,QueryResultTable}.tsx`,
      `components/pages/AdminQueryPage.tsx` at `/admin/query`,
      `SqlConsoleIcon` + a new "SQL Query" Admin tile, `test-data/
      adHocQueryResult.ts` (one canned resultset — mock mode has no real
      Athena to differentiate queries against), full mirrored tests.
      **Superseded by Leg 8** — `AdminQueryPage`/`/admin/query` become
      `AdminWarehousePage`/`/admin/warehouse` once the page grows a
      Schema tab and job authoring; `SqlQueryConsole` itself is unchanged,
      just relocated into that page's Query tab.
- [x] CDK test asserting the ad-hoc Lambda's IAM carries no
      `dynamodb:Put*`/`Update*`/`Delete*`, `glue:CreateTable`/
      `UpdateTable`/`DeleteTable`, or access to the job runner's own
      workgroup/output prefix.
- [x] `backend`/`cdk`/`web-app` build/lint/`test:coverage` all green
      (90%+ per file) — 2026-09-13.
- [x] **Manually verified in the browser (mock mode)**: signed in as the
      mock admin, `/admin` shows the new "SQL Query" tile, `/admin/query`
      renders the console, a `SELECT` returns the canned 5-row resultset
      with row-count/timing summary, and a `DELETE` is rejected client-side
      with "Only SELECT/WITH/SHOW/DESCRIBE/EXPLAIN statements are allowed".
- [ ] **Not yet deployed to `Nyc311-Test`/verified live against real
      Athena** — pending push + deploy; live verification is a real
      `SELECT` returning real warehouse rows, a non-`SELECT` rejected at
      `400`, and (harder to trigger deliberately) the 20 s timeout path.

### Leg 8 — self-service job authoring (§8/§9/§12b, Appendix A.11) — **built 2026-09-13, not yet deployed**

Triggered by a real production incident, not a nice-to-have: Leg 6
adding a 4th job pushed the old `WAREHOUSE_JOBS` env-var manifest past
Lambda's environment-variables payload limit, failing `Nyc311-Test`'s
CloudFormation update outright (`UpdateFunctionConfiguration ... 413`).
Fixing the root cause (move job SQL off env vars) and building
self-service authoring (already wanted, Open Items) turned out to be
the same change.

- [x] `backend/models/warehouseJobDefinition.ts` (`record_type`
      discriminator added to `warehouseJobRun.ts` too), `dao/analytics/
      warehouseJobRunsDao.ts` (definition-row `put`/`get`/`delete`/`list`
      methods, `gsi1pk = "JOB#DEFINITIONS"`).
- [x] `service/analytics/warehouseJobDefinitionService.ts` — job
      create/delete (S3 `PutObject`/`DDB` conditional `PutItem`/
      `scheduler:CreateSchedule`, in that order; delete reverses it,
      keeping run history) using the new `@aws-sdk/client-scheduler`
      dependency.
- [x] `controller/web-api/{createWarehouseJobController,
      deleteWarehouseJobController,listWarehouseJobsController}.ts` —
      admin-authorized, `POST`/`DELETE`/`GET /admin/warehouse/jobs[/{name}]`.
- [x] `service/analytics/warehouseJobRunnerService.ts` rewritten: the
      cross-job retry sweep + `for (const job of jobs)` loop is gone,
      replaced by one job's lookup (DDB `GetItem` + S3 `GetObject`) +
      its own retry decision. `controller/analytics/
      runWarehouseJobController.ts`'s trigger schema becomes `{job_name:
      string}` (was empty).
- [x] `cdk/warehouse/Nyc311WarehouseJobScheduleGroup.ts` — the
      `scheduler.CfnScheduleGroup` + the shared invocation IAM role,
      replacing the deleted `Nyc311WarehouseJobSchedule.ts` (its DLQ is
      kept and re-referenced, its per-schedule failure alarm is not —
      see below).
- [x] `cdk/warehouse/Nyc311{Create,Delete,List}WarehouseJobApiLambda.ts`
      — three separate Lambdas per §12b/§15 (matching Capacity's
      per-route CRUD precedent), each with least-privilege IAM; only
      `Create` gets `iam:PassRole`, narrowly scoped to one ARN.
- [x] CDK tests assert `Create`'s `PassRole` resource is exactly one ARN
      (never `*`/a wildcard), and that `Delete`/`List` have no
      `iam:PassRole` grant at all.
- [x] Frontend: `models/{warehouseJobDefinition,cronSchedule}.ts`,
      `services/warehouseJobDefinitionService.ts` (mock + live),
      `hooks/{useWarehouseJobDefinitions,useCreateWarehouseJob,
      useDeleteWarehouseJob}.ts`, `components/query/CronScheduleBuilder.tsx`,
      `components/warehouseJobs/{JobDefinitionList,JobDefinitionForm}.tsx`,
      `components/pages/AdminWarehousePage.tsx` at `/admin/warehouse`
      (replaces `AdminQueryPage.tsx`/`/admin/query`) with a 3-tab strip
      (Schema reused from `/data`, Query from Leg 7, Jobs new), fixtures,
      full mirrored tests. Built and verified 2026-09-13 (web-app build/
      lint/`test:coverage` all green, 667 tests).
- [x] `test-scripts/9-backfill-warehouse-jobs.py` — one-time, SQL text
      embedded in the script — creates all four pre-Leg-8 jobs
      (`order_volume_by_stage_7d`, `order_volume_by_stage_8w`,
      `order_volume_by_borough`, `operator_fleet_cost_to_date`) via the
      new `POST /admin/warehouse/jobs`, `cron(0 9 * * ? *)` for all four.
      Written 2026-09-13; **running it is still pending** — happens
      against `Nyc311-Test` then `--prod` for `Nyc311-Prod`, after this
      leg's own deploy (the API it calls has to exist first).
- [x] `cdk/warehouse/sql/*.sql` and `readJobManifest()`/`WAREHOUSE_JOBS`
      deleted, in the same change that adds the above (not a separate
      follow-up — the runner's trigger contract change makes the two
      inseparable).
- [x] Not extended to alarms-per-job: the pre-existing Lambda-level
      `Errors` alarm (§14, unchanged) still covers every job's failures
      in aggregate; no per-schedule alarm is created dynamically. A
      stuck single job is visible on `/data`'s Jobs tab
      ("retries exhausted"), same as before Leg 8.
- [ ] Verify live in `Nyc311-Test`: create a job through `/admin/warehouse`
      end to end (schema tab informs the query, save-as-job, see it in
      the Jobs tab, see its schedule actually fire and produce a run);
      delete a job and confirm its schedule stops firing but its history
      stays visible; run the backfill script and confirm all four
      original jobs keep producing the same resultsets on the same
      cadence as before.

### Doc

- [x] `business-insights.md` §3 — "superseded by `7-data-warehousing.md`
      for implementation detail" note added.

---

## Open Items

- **History read path — the `/reports` page.** ✅ Built 2026-09-07 (§12,
  Build Checklist). "Reports" tile on `/monitoring` → `/reports` →
  `GET /reports`, which assembles a weekly trend from each registered
  report job's materialized `result.json` (no Athena on the read path).
  Today one report (`order_volume_by_stage_8w`); this is the seam the
  centralized reporting layer grows from. The `job_results` history table
  (§11) still makes deeper "trend of trends" ad-hoc Athena-queryable.
- **biz-intel-agent** ([#24](https://github.com/seththeeke/nyc-311/issues/24))
  — an agent that owns *authoring good jobs* (which aggregations matter,
  what a job's SQL should compute) and Athena/Glue efficiency work,
  replacing standing BI work. Leg 8 already solved the *mechanics* of
  registering a job (no more "an agent would need repo write access to
  add a `.sql` file") — this item is now scoped to judgment/authorship,
  not plumbing. Still deferred until `Cases`/`Shifts` land and `/reports`
  is more established.
- **User-authored SQL jobs / self-service job authoring.** ✅ **Built
  2026-09-13 (Legs 7 + 8, §12a/§12b).** `POST /admin/warehouse/query`
  (Leg 7) for one-off queries; `POST`/`GET`/`DELETE
  /admin/warehouse/jobs[/{name}]` (Leg 8) for turning one into a real
  scheduled job — DDB definition + S3-stored SQL + its own EventBridge
  Scheduler cron schedule, no `.sql` file or deploy. **Still open:** a
  real multi-user/multi-tenant auth model (today there's exactly one
  admin, matching `9-admin-auth-integration.md`'s single-admin design
  throughout this whole app, not something Leg 8 was ever meant to
  change) and query history/saved-but-not-scheduled queries (Leg 8 only
  persists a query once it becomes a real job).
- **`/data` write actions.** No "retry"/"rebuild" button, no `POST`
  routes. **Deferred indefinitely** — would need real role-gated auth
  (`2-pipeline-monitoring.md` §11's unbuilt `AuthenticatedRoute`). §10's
  rebuild stays script-triggered under the `nyc311` profile. (Unrelated to
  Leg 7's admin console above — that's a new, separately-authorized route,
  not a write added to `/data` itself.)
- **`Cases`/`Shifts`.** Join this same pipeline once those tables are
  built — no redesign needed, per §3's design principle. (`Operators`
  already made this exact move — Leg 6, 2026-09-13.)
- **Extend Leg 4's rebuild to `Operators`.** Leg 6 added live capture +
  a job for `Operators`, but deliberately left the on-demand rebuild
  state machine at its original three sources (§10/Naming Reference).
  Adding a fourth serial source is the same shape as the existing three
  — not a redesign, just not done yet.
- **Every other `business-insights.md` §2 aggregation** (cost model, Case
  MTTR, SLA-breach rate) — designed-not-built; each is now a
  self-service job through `/admin/warehouse` (Leg 8), not a `.sql` file
  + deploy. On hold until more of the domain exists (`Cases` in
  particular); then biz-intel-agent
  ([#24](https://github.com/seththeeke/nyc-311/issues/24)) owns
  authoring them.
- **Compaction / small-file consolidation** — **deferred indefinitely**;
  folded into biz-intel-agent's efficiency scope (#24). §9's captured
  `data_scanned_bytes` / `engine_execution_time_ms` per run are the
  baseline it would measure against.
- **Same-day retry overwrites.** A `RETRY` run overwrites that
  `run_date`'s `result.json` (later run wins — a retry corrects). Clean
  for the API's "latest" read and for the `job_results` history table
  (one row per `run_date`); the superseded resultset is lost, which is
  the intended semantics for a retry.

---

## Appendix: Design Rationale & Alternatives Considered

### A.1 — Why the original "Slice A / Slice B" split was dropped

The lake-only build (land data, stop) was the safer sequencing — §8/§9's
shape genuinely depends on what the real data looks like. But it leaves
the harder half (the job runner, the retry/tracking model, the SQL-asset
question) undesigned. Building one real sample job end to end instead
validates that harder half now and becomes the literal template for every
future job and future entity, at the cost of slightly more work up front.

### A.2 — Stream tap: four rejected options before the chosen design

**The constraint:** DynamoDB Streams tolerates at most ~2 simultaneous
consumers per shard before elevated throttling; both the `Orders` and
`Requests` streams were already at one consumer each.

- **Reuse the SNS topic for `order_events`, add a dedicated Lambda for
  `Requests`.** Rejected: the existing `Nyc311OrderEventsTopic` never
  carried the `#METADATA` projection row, so "reuse what exists" only
  solved half the Orders-side problem anyway, and still spent the
  Requests stream's last consumer slot.
- **EventBridge Pipes** (DynamoDB Stream → Pipe → Firehose). Rejected: a
  Pipe is itself a stream consumer — same ceiling problem, plus a new,
  unused-elsewhere mental model in this project.
- **A dedicated warehouse-only fan-out Lambda per stream.** Rejected:
  uniform, but still spends both streams' last consumer slot, and adds
  two new Lambdas for something the existing ones could just as easily
  route.
- **Switch the tables to also emit a Kinesis Data Stream** (`TableV2`'s
  `kinesisStream`, additive alongside `dynamoStream`). Removes the
  consumer ceiling permanently and needs zero fan-out code, but costs
  ~$29-58/month on-demand — the only materially non-trivial recurring
  cost considered anywhere in this design. Rejected in favor of the
  chosen option, which gets the same ceiling-removal for $0.

**Chosen: widen the two existing fan-out Lambdas** to route every record
shape on their stream, not just the one each was originally built for.
Zero new consumers, zero new recurring cost, and it generalizes cleanly —
`Cases`/`Operators`/`Shifts` get the same one-Lambda-routes-everything
treatment when they ship, not a growing pile of warehouse-only Lambdas.

### A.3 — File format: Parquet vs. JSON.gz

JSON.gz is simpler and tolerates schema drift with zero pipeline impact.
Parquet was chosen instead because explicit typing is real, measurable
value here — real columns for every field a report actually
filters/groups on, opaque strings only for genuinely variable-shape
payloads — and it's what makes §6's drift-detection test a real,
worthwhile mechanism rather than solving a non-problem.

### A.4 — Schema evolution: drift-detecting test vs. full codegen

A generator deriving `CfnTable` columns directly from each zod schema
(rather than just checking them against each other) would remove the
manual "add a column" step entirely. Rejected for now: it needs a real
zod-type → Glue-column-type mapping maintained somewhere (zod's string/
number/enum types don't map 1:1 onto Glue's string/bigint/double/
timestamp), plus deciding column order and which fields stay
deliberately opaque — the allowlist still has to exist either way. A
drift-*test* gets the actual safety property ("you cannot silently ship a
schema that's out of sync") for far less mechanism; revisit only if the
table count grows enough that hand-editing columns becomes the real
bottleneck.

### A.5 — Landing-zone structure: why a single unified location, and why wipe-and-reload instead of query-time dedup

Three designs were weighed:

1. **Separate `raw/` (live stream) and `backfill/` (periodic export)
   locations, unioned at query time.** The original design. Real risk: a
   record already committed to DynamoDB but still sitting in Firehose's
   buffer at export time gets captured by *both* the export and the
   eventual buffer flush, and `UNION ALL` double-counts it.
2. **One unified location, every query deduplicating by natural key
   (latest-`warehouse_ingested_at` wins).** Removes the two-location
   confusion, but makes every consuming query pay a `ROW_NUMBER()`
   dedup step, and was explicitly rejected as too expensive an ongoing
   query-authoring tax.
3. **One unified location, wipe-and-reload on rebuild (chosen).** No
   `UNION ALL`, no query-time dedup — a rebuild always produces exactly
   one, complete, non-overlapping copy of a source's data. The remaining
   risk (the same live-stream-vs-export race as design 1) is closed
   structurally instead of query-side: §10's isolated pause/resume
   sequence, pinning the export's `ExportTime` to the exact instant
   before Firehose resumes, guarantees no gap and no overlap.

**The `dt`-loses-original-date tradeoff** (a rebuild's replayed rows all
land under one `dt=<rebuild-date>` partition, not their true historical
dates) costs only partition-pruning efficiency, not accuracy — every
row's real `occurred_at`/`created_at` remains an exact queryable column
regardless of which physical partition holds it. At this project's data
volume (kilobytes-to-megabytes per day), that efficiency loss is a
non-issue.

### A.6 — Rebuild isolation: why the fan-out Lambda is never paused

An earlier draft of §10 paused the fan-out Lambdas' DynamoDB Streams
event source mappings during a rebuild, to prevent the same
stream-vs-export race described in A.5. This was wrong: those Lambdas
also carry *operational* traffic (order evaluation, request promotion) —
pausing them to protect the warehouse would stall the live system for the
whole rebuild.

**Fix: pause Firehose's own SNS subscription instead**, a purely
warehouse-side resource with no operational role. The fan-out Lambda
keeps publishing to every topic uninterrupted throughout a rebuild; only
Firehose stops *listening*, and only for the source actually being
rebuilt. Resubscribing happens immediately after the S3 wipe (not after
the — potentially much longer — export completes), so live capture is
back online within roughly the 300s buffer-drain window, decoupled from
export duration. Pinning the export's `ExportTime` to the exact
pre-resubscribe instant (rather than "now," or `LATEST` on a
re-created Lambda mapping) is what makes the boundary exact rather than
approximate — `LATEST` was considered and rejected because it leaves a
window of writes that land in neither the export nor the live stream.

One honest caveat: DynamoDB PITR typically cannot export to a point
within roughly the last 5 minutes of real time. Pinning `ExportTime` to a
moment mere seconds old may need a small buffer or retry — to be verified
empirically against the real API when building, not asserted as certain
here.

### A.7 — Why replay reuses Firehose instead of a second Parquet-writing path

A DynamoDB export lands as `DYNAMODB_JSON`, not Parquet — it cannot be
read directly by a Parquet-schema'd Glue table. The alternative considered
was an Athena CTAS step (stage the export under a temporary JSON-schema'd
table, `CREATE TABLE ... WITH (format='PARQUET') AS SELECT ...` into the
final location). Rejected in favor of routing replayed records through
the **same** Firehose delivery stream the live pipeline already uses:
this guarantees the rebuild's output and the live stream's output go
through identical conversion logic and an identical schema, with no
second mechanism to keep in sync, and it reuses `unmarshall()` — the exact
same DynamoDB-JSON-to-plain-JSON step the fan-out Lambdas already perform.

### A.8 — Query-performance metrics: captured, not yet acted on

Athena's `GetQueryExecution` already returns `Statistics`
(`DataScannedInBytes`, `EngineExecutionTimeInMillis`,
`QueryQueueTimeInMillis`) as part of the poll loop the job runner already
runs — capturing these into `WarehouseJobRuns` costs nothing new to
fetch. File-count/size metrics (the actual small-files signal, and the
concrete precursor to any future compaction work) are a separate thing
Athena doesn't hand back directly — deliberately not built this round
(see Open Items); the query-performance numbers already captured are
enough to establish there's a real, measurable baseline to compare
against once compaction is worth doing.

### A.9 — `business-insights.md` §3, corrected

- §3.1's pipeline diagram lists `OrderEvent, ShiftEvent, CaseEvent`
  streams. `ShiftEvent` no longer exists (`Shift` became a plain record
  per `data-model.md`); `Cases`/`Operators`/`Shifts` aren't built. The
  only real sources today are `Orders` (event + projection) and
  `Requests`.
- §3.1/§3.3 draw "DynamoDB Streams → Kinesis Data Firehose → S3" as one
  arrow. Firehose has no native DynamoDB Streams source (Direct PUT,
  Kinesis Data Stream, or MSK only) — there's always a hop in between;
  §4 is that hop.
- `Nyc311OrderEventsTopic` (`5-order-evaluation.md` §3) didn't exist when
  §3 was written — it's part of why the stream-tap analysis in A.2 came
  out the way it did.

### A.10 — Why job results moved from a DynamoDB EAV table to S3 resultsets

Leg 3 shipped `AnalyticsRollups` — a DynamoDB table with `metric_view`
(PK) / `<run_date>#<dimension>` (SK) / `value`, and a fold loop in the
runner turning each query result row into one item. It worked for the
1-D sample job (count per stage). It broke down the moment a second
dimension appeared: `order_volume_by_stage_7d` is created-date × stage,
and the EAV key had nowhere to put the second axis without encoding a
composite string into `dimension` — at which point the "structure" the
table imposed was actively lying about the data.

The deeper issue: this layer isn't a dashboard backend, it's the app's
**reporting substrate**. Ad-hoc Athena queries, user-authored SQL jobs,
features built on job output, Athena views layered on job history — all
of that wants the raw resultset, not a shape pre-chewed for one chart.
Every bespoke fold rule in the runner is coupling the warehouse layer to
one consumer's needs.

So: the runner stores the Athena resultset **verbatim** —
`{ columns, rows }` as a self-describing JSON envelope in S3, immutable,
one object per run. That same object *is* the history record: one
CDK-declared Glue table (`job_results`, `rows array<map<string,string>>`,
partition projection on `job_name`/`run_date`) sits over the whole
prefix, so "trend of trends" is a `CROSS JOIN UNNEST` query with no
second write. The runner never inspects what a query returns and never
touches the catalog. Adding a job is adding a `.sql` file. Consumers own
their shaping: the `/data` page has one small renderer per `job_name`,
an unknown job falls back to a generic table, and a job wanting typed
history columns gets an Athena `CREATE VIEW`.

Costs: the dashboard read is an `s3:GetObject` (~30ms) instead of a
single-digit-ms DynamoDB `Query` — irrelevant here. Row values are
strings (Athena's native output) + a `type` per column — consumers cast.
What it buys: no per-job backend code ever again, immutable versioned
results, and history queryable from day one with only read grants on the
runner.

Rejected: (a) keeping `AnalyticsRollups`, encoding the 2-D key as a
composite `dimension` string — pure-SQL but the model lies and the UI
shows raw `2026-09-01|SCHEDULE` labels; (b) generalizing the DynamoDB
table with a `dimensions: map` attribute — still EAV, still fights
ad-hoc SQL; (c) per-job Glue tables via Athena `CTAS`/`INSERT INTO` —
real typed columns, but needs `glue:CreateTable` on the runner, a second
Athena query per run, and `external_location` is fragile if a table is
ever dropped; the `map<string,string>` table + optional views gets 90%
of the value with read-only grants and one write; (d) a per-job Step
Functions machine — orchestration for a KB-scale query, and it fights
"a job is just a `.sql` file."

### A.11 — Why job definitions moved off checked-in `.sql` files + a Lambda env var (Leg 8, 2026-09-13)

The trigger was a real deploy failure, not a hypothetical: adding
`operator_fleet_cost_to_date.sql` as the 4th registered job pushed the
`WAREHOUSE_JOBS` env var (every job's name + full SQL text,
JSON-encoded, injected into `Nyc311WarehouseJobRunnerLambda` at synth)
to ~4.6KB, and `cdk deploy`'s `UpdateFunctionConfiguration` call for
that Lambda failed outright — `Request must be smaller than 5120 bytes`.
Lambda's environment-variables payload has a hard ceiling; there was no
"deploy anyway, degrade gracefully" path once crossed.

This wasn't really a size-tuning problem, though — trimming SQL comments
would have bought maybe one more job before recurring. The doc's own
stated design ("adding a job is adding a `.sql` file," `business-insights.md`'s
full aggregation list, biz-intel-agent (#24) eventually authoring jobs
autonomously) always assumed the job count would keep growing, and an
env-var manifest was never going to scale with it. Separately, Leg 7's
ad-hoc console had already opened the door to "run a query through the
app" — turning a good one into a real scheduled job was the obvious next
ask, and had already been flagged as the still-open half of the
"user-authored SQL jobs" Open Item. Both problems point at the same fix.

**Chosen:** a job definition is a DynamoDB record (reusing
`WarehouseJobRuns` — no new table) pointing at its SQL in S3
(`job-definitions/<name>.sql`, plain text, no parsing format to get
wrong), with its own EventBridge Scheduler `cron(...)` schedule created
at runtime when the definition is created — not declared in CDK, since
job identities no longer exist at synth time. The runner Lambda is
unchanged in what it *does* (StartQueryExecution → poll → GetQueryResults
→ S3 resultset → `WarehouseJobRuns` update, §8); only how it gets to
"the SQL to run" changed. This removes the size ceiling entirely (an S3
object has no meaningful size limit for a SQL query), and turns "add a
job" from "edit the repo, redeploy the whole pipeline" into "one API
call the Admin UI already needed to make."

**Rejected:**
- **A dedicated `WarehouseJobs` table**, definitions separate from
  `WarehouseJobRuns`. Cleaner single-responsibility per table, but the
  chosen partition-key/GSI design (§8) gets the same separation *within*
  one table for free — a `record_type` discriminator and a distinct
  `gsi1pk` value, the same trick `Orders`/`Operators` already use for a
  different entity. No new table, one less piece of infrastructure.
- **Storing SQL text directly in the DDB item** instead of S3. Works for
  today's few-hundred-byte queries, but reintroduces exactly the kind of
  size ceiling this leg exists to remove (DynamoDB items cap at 400KB —
  much roomier than Lambda's env-var limit, but still a ceiling, and one
  a sufficiently large generated query could hit). S3 has no comparable
  limit worth worrying about, and storing plain `.sql` text (not a JSON
  field) sidesteps any escaping/parsing question entirely.
- **A per-job Lambda or Step Functions machine**, so each job's schedule
  could carry more job-specific configuration. Same rejection as A.10(d)
  — orchestration for a KB-scale query buys nothing, and it would mean
  reintroducing per-job infrastructure right after Leg 3.5 deliberately
  moved away from per-consumer special-casing.
- **A shared cron/rate hybrid model** (some jobs on `rate()`, some on
  `cron()`). `cron()` alone is a strict superset of what `rate()`
  expresses, and one expression type keeps the schedule-builder UI and
  the backend validation simpler for a negligible loss of concision on
  the "every N hours" case.
