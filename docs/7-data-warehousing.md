# Data Warehousing — Orders/OrderEvents/Requests Into a Queryable SQL Store

> **Status: Design finalized for the Orders/OrderEvents/Requests pipeline
> (2026-09-05). The `/data` frontend prototype (§12) is built (mock-only);
> everything else is designed, not yet built** — see the
> [Build Checklist](#build-checklist). Written **declaratively** — this
> doc describes what will be built, not the negotiation that produced it.
> Tradeoffs, rejected alternatives, and the reasoning behind each call live
> in the [Appendix](#appendix-design-rationale--alternatives-considered),
> not inline. Anything still genuinely undecided is called out explicitly
> in [Open Items](#open-items), not folded into the declarative sections.
>
> This is the implementation-level build-out of `business-insights.md` §3
> ("Analytics Infrastructure"), which already set the top-level engine
> choices this doc builds against: **S3 + Athena, not Redshift** (§3.2);
> **Kinesis Firehose for landing** (§3.3); **manual Glue DDL, no crawler**
> (§3.5); **EventBridge Scheduler → Step Functions → Athena** for job
> orchestration (§3.4); **pre-aggregated results copied into a dedicated
> DynamoDB table** for the dashboard API to read (§3.6). This doc
> supersedes `business-insights.md` §3.1/§3.3 where they conflict (see
> Appendix A.9) and closes every `[OPEN]` item that section left.
>
> `backend/`/`cdk/` are already unlocked (`CLAUDE.md` §5.1/§5.2). This doc
> also proposes one genuinely new repo convention — `.sql` files as
> versioned assets under `cdk/warehouse/sql/` (§13) — flagged in Open
> Items as still wanting explicit sign-off before code lands.

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
EventBridge Scheduler (daily) ──► Step Functions job runner
                                       │  runs order_volume_by_borough.sql
                                       ▼
                              AnalyticsRollups (DynamoDB)
                                       │
                              WarehouseJobRuns (DynamoDB) ◄── also written
                                       │                       by the
                                       │                       on-demand
                                       ▼                       rebuild (§10)
                          GET /data/jobs, GET /data/schema (live Glue read)
                                       │
                                       ▼
                                  /data page (public, read-only)
```

A separate, on-demand **`Nyc311WarehouseRebuildStateMachine`** (§10) can
fully wipe and re-derive any source's warehoused data straight from
DynamoDB at any time, independent of this live pipeline.

---

## 2. Scope

This build delivers, end to end, for **`Orders` (both `OrderEvent` and the
`Order` projection) and `Requests`**:

- Live change capture off DynamoDB into S3, catalogued in Glue and
  queryable ad hoc in Athena.
- One real scheduled aggregation — **daily order volume by borough** —
  running on a genuine EventBridge → Step Functions → Athena job runner,
  writing to a DynamoDB serving table.
- Job run history, automatic bounded retry, and query-performance metrics
  for every run.
- An on-demand, fully isolated rebuild capability per source.
- A public, read-only `/data` page surfacing warehouse schema and job
  history.

**Explicitly out of scope for this build** (see [Open Items](#open-items)):
`Locations`, every aggregation in `business-insights.md` §2 beyond the one
sample job, `Cases`/`Operators`/`Shifts` (not built yet), and any write
action on `/data`.

---

## 3. Data Sources

| Source | Warehouse table | Role |
|---|---|---|
| `Orders` table — `OrderEvent` items (`EVENT#<n>`) | `order_events` | Fact stream — every `ORDER_CREATED`/`ORDER_ACCEPTED`/`ORDER_REJECTED`/`ORDER_SCHEDULED`/… with `occurred_at`, `stage`, `actor`, `payload`. |
| `Orders` table — `#METADATA` projection | `order_snapshots` | Current-state dimension — `current_stage`, `status`, `location_id`, `sla_deadline`, `priority_tier`, etc. as plain typed columns. |
| `Requests` table — real `Request` rows | `requests` | Intake dimension + status CDC — `complaint_type`, `agency`, `created_at`, and every `DRAFT → PROMOTED/FILTERED/DUPLICATE/REJECTED` transition. |

**Excluded, by design:** `Requests`' `METRIC#<ulid>` poller-metrics rows
and `CURSOR#NYC_311` sentinel (operational, already served by
`GET /ingestion/metrics`) — the widened fan-out Lambda's relevance check
(§4) filters these out before they ever reach a topic.

**Deferred:** `Locations` (see Open Items), `CaseEvent`/`Cases`,
`OperatorEvent`/`Operators`/`Shifts` (none of these tables exist yet).
When any of them ship, each attaches to this exact pipeline the same
way — one more fan-out branch, one more Firehose, one more Glue table —
not a redesign.

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

**Partitioning: Athena partition projection** (`projection.enabled = true`,
`projection.dt.type = date`, `projection.dt.range = 2026-09-01,NOW`,
`storage.location.template = s3://…/data/<table>/dt=${dt}/`). No
`MSCK REPAIR`, no `ALTER TABLE ADD PARTITION`, no crawler.

---

## 8. The Sample Job & Job Orchestration

**Job: `order_volume_by_borough`** — daily `COUNT(*)` of Orders per
`borough`, joining `order_snapshots` to `locations`... *(pending
`Locations` — see Open Items; until `locations` is warehoused, the query
joins `order_snapshots` against a live `dynamodb:GetItem`-backed lookup is
**not** an option for a SQL job, so this job's first real run is blocked
on `Locations` landing — named explicitly, not silently glossed over)*.

**Orchestration: EventBridge Scheduler (`rate(1 day)`) → Step Functions →
Athena**, mirroring the poller's scheduled-job precedent:

1. **Retry sweep** (§9) — retry any eligible previously-failed run first.
2. **`AthenaStartQueryExecution`** (`aws-stepfunctions-tasks`, direct
   service integration — no Lambda) runs `order_volume_by_borough.sql`
   (§13) against the one Athena workgroup.
3. **`AthenaGetQueryExecution`** polls to completion, capturing
   `Statistics` (`DataScannedInBytes`, `EngineExecutionTimeInMillis`,
   `QueryQueueTimeInMillis`) for §9.
4. **Result-copy Lambda** (`backend/controller/analytics/`) reads the
   query result and writes it into `AnalyticsRollups` (§11) via a new DAO
   — entered through a controller with a zod-parsed trigger model, per
   `CLAUDE.md` §5.2.
5. **`RecordJobRun`** (§9) writes the outcome, including the captured
   query statistics.

---

## 9. Job Run Tracking & Automatic Retry

**Table: `WarehouseJobRuns-<env>`** (plain `Dao<T>`, not event-sourced).

| Field | Notes |
|---|---|
| `job_run_id` | PK. ULID. |
| `job_name` | e.g. `"ORDER_VOLUME_BY_BOROUGH"`, or `"REBUILD_ORDER_EVENTS"`/`"REBUILD_ORDER_SNAPSHOTS"`/`"REBUILD_REQUESTS"` for §10's on-demand rebuilds — same table, one more `job_name` value. |
| `status` | `RUNNING` \| `SUCCEEDED` \| `FAILED`. |
| `trigger` | `SCHEDULED` \| `RETRY` \| `MANUAL` (the on-demand rebuild path, §10). |
| `started_at` / `completed_at` | `completed_at` nullable while `RUNNING`. |
| `execution_ref` | Athena `QueryExecutionId`, the DynamoDB export ARN, or the Step Functions execution ARN — opaque, interpreted per `job_name`. |
| `error_message` | Nullable. |
| `retry_count` | `0` for an original run; a `RETRY` row carries `previous.retry_count + 1`. |
| `retried_from_job_run_id` | Nullable FK, links a `RETRY` row to what it's retrying. |
| `data_scanned_bytes` | Nullable — Athena's `Statistics.DataScannedInBytes`, query jobs only. |
| `engine_execution_time_ms` | Nullable — Athena's `Statistics.EngineExecutionTimeInMillis`. |
| `query_queue_time_ms` | Nullable — Athena's `Statistics.QueryQueueTimeInMillis`. |

**GSIs:**
- `gsi1-recent-runs` — `gsi1pk = "JOB#RUNS"` (fixed constant), `gsi1sk =
  started_at`. Backs `/data`'s most-recent-first view.
- `gsi2-status` — `gsi2pk = status`, `gsi2sk = started_at`. Backs the
  retry sweep: `Query gsi2pk = "FAILED"`.

**Write path:** a `RUNNING` row at start, updated to `SUCCEEDED`/`FAILED`
at completion — every run recorded regardless of outcome. The tracking
write itself is wrapped in its own try/catch that only logs on failure,
never allowed to change the real outcome it's describing.

**Automatic retry:** at the start of each scheduled invocation, before
running the day's regular job, the runner queries `gsi2-status` for
`status = "FAILED"` rows with `retry_count < MAX_JOB_RETRIES` (**3**) and
re-runs each one, writing a new `RETRY`-triggered row. This is on top of
whatever `Retry`/`Catch` the Step Functions definition does at the task
level — the sweep picks up a run that failed *and exhausted* its
in-execution retries, on the *next* scheduled invocation. Once
`MAX_JOB_RETRIES` is exhausted, a run simply stops being retried
automatically and shows as permanently failed on `/data` — no automatic
Case creation. Same Lambda/schedule as §8, not a second cron.

---

## 10. On-Demand Rebuild

**`Nyc311WarehouseRebuildStateMachine`** — manually triggered (never
scheduled), fully wipes and re-derives one or more sources' warehoused
data directly from DynamoDB, without ever touching the operational fan-out
Lambdas or their event source mappings, and without pausing any
operational traffic (order evaluation, request promotion continue
uninterrupted throughout).

**Input:** `{ sources: string[] }` (defaults to all three).

**Per source, run in parallel (`Map` state):**

1. **`PauseCapture`** — `sns:Unsubscribe` the source's Firehose
   subscription from its topic (`CallAwsService`). The fan-out Lambda
   keeps running and keeps publishing to this topic throughout — only
   Firehose stops receiving.
2. **`DrainBuffer`** — `Wait` 300s, covering Firehose's own buffering
   window so nothing already in flight before the unsubscribe is lost.
3. **`WipePrefix`** — a Lambda (`controller/data-archival/
   emptyWarehousePrefixController.ts`) deletes every object under
   `data/<source>/`.
4. **`ResumeCapture`** — `sns:Subscribe` Firehose back onto the topic
   (unfiltered, no config to reproduce), immediately after the wipe.
   Records the exact pre-subscribe timestamp as `T`. Live capture is back
   online within this step, bounded by steps 1–3's duration, independent
   of how long the export below takes.
5. **`StartExport`** — `dynamodb:exportTableToPointInTime`
   (`ExportFormat: DYNAMODB_JSON`, `ExportTime: T`) landing into
   `export-staging/<source>/<export-id>/`. Pinning `ExportTime` to `T`
   (the instant captured in step 4, *before* the resubscribe took effect)
   guarantees no gap and no overlap with what the now-live stream
   captures from `T` forward.
6. **`WaitForExport`** — poll `dynamodb:describeExport` to `COMPLETED`.
7. **`ReplayExportFiles`** (`Map` state, one branch per exported data
   file) — a Lambda reads one export file, `unmarshall()`s each
   DynamoDB-JSON item into the same plain-JSON shape the live fan-out
   Lambdas already produce, and calls `firehose:PutRecordBatch` (batched,
   ≤500 records/call) against the **same** per-source Firehose delivery
   stream the live pipeline uses — reusing its existing Parquet
   conversion rather than a second, parallel conversion mechanism. The
   replayed rows land in `data/<source>/dt=<T's date>/` once Firehose's
   own buffer flushes.
8. **`RecordJobRun`** — writes a `WarehouseJobRuns` row, `job_name =
   "REBUILD_<SOURCE>"`, `trigger = "MANUAL"`.

**After every source's branch completes:** `RecomputeRollups` re-runs
`order_volume_by_borough.sql` so `AnalyticsRollups` reflects the rebuild
without waiting for the next scheduled invocation.

**Trigger: `test-scripts/5-warehouse-rebuild.py`** — looks up the state
machine's ARN (a new `CfnOutput`), calls `aws stepfunctions
start-execution --profile nyc311`, polls `describe-execution`, prints a
summary. An operator running a script under the `nyc311` profile — not a
`/data` page action (§12).

---

## 11. Serving Layer

**Table: `AnalyticsRollups-<env>`** — PK `metric_view` (e.g.
`"ORDER_VOLUME_BY_BOROUGH"`), SK the dimension + period key (e.g.
`"2026-09-05#QUEENS"`). One table, every future view lands here the same
way. Backed by a plain `Dao<T>`, a new `service/analytics/`, and a
`controller/web-api/` GET route, same pattern as every existing read path
in the app. The route(s) participate in
`4-pipeline-integration-tests.md`'s endpoint-coverage gate.

---

## 12. The `/data` Page

A new, top-level route (`/data`, `PublicRoute` tier — not nested under
`/monitoring/`; linked from the home page as "Explore the data
warehouse"). **The frontend is built and the layout is settled (mock-only
prototype, 2026-09-05 — see Build Checklist).** Backed by two read-only
GET routes the backend must implement to the shapes below.

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
  of a `role="tabpanel"`, switching between two views:
  - **Jobs** — client-side filters (status / trigger / `job_name`
    substring) over a most-recent-first run table. Condensed rows (job
    name, status icon + screen-reader label, trigger badge, started,
    duration) expand to a detail row: run id, `execution_ref`, the retry
    chain (`↻ retry of <id>`, plus a "retries exhausted (max 3)" note
    once `retry_count >= MAX_JOB_RETRIES`), the query-performance stats,
    and the error message. A backfill/rebuild run is just another row,
    `job_name` starting `REBUILD_`.
  - **Performance** — the runs that carry Athena execution metrics
    (non-null `data_scanned_bytes` / `engine_execution_time_ms` /
    `query_queue_time_ms` — i.e. query runs, not rebuilds or
    still-running jobs), as a summary line (`N query runs · avg engine
    time · avg scanned`) over a per-run metrics table. This is the
    concrete surface for the time series Appendix A.8 keeps for later
    compaction/optimization analysis.

### The two routes — response contracts

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
  "job_run_id": "01J…", "job_name": "ORDER_VOLUME_BY_BOROUGH",
  "status": "SUCCEEDED",              // RUNNING | SUCCEEDED | FAILED
  "trigger": "SCHEDULED",             // SCHEDULED | RETRY | MANUAL
  "started_at": "2026-09-04T09:00:01.000Z",
  "completed_at": "2026-09-04T09:00:14.000Z",   // null while RUNNING
  "execution_ref": "…",                          // null | Athena QueryExecutionId | export ARN | SFN exec ARN
  "error_message": null,
  "retry_count": 0,
  "retried_from_job_run_id": null,
  "data_scanned_bytes": 4213888,                 // null unless a completed Athena query
  "engine_execution_time_ms": 1842,              // null …
  "query_queue_time_ms": 96                       // null …
} ] }
```

These are exactly the shapes `web-app/src/models/warehouseSchema.ts` and
`warehouseJobRun.ts` already validate every response through — the
backend build hooks into the mocked interface without a frontend change.

### No write routes

No "retry this job" or "run a rebuild" button, no `POST` routes — see
Open Items. §10's rebuild stays script-triggered under the `nyc311`
profile.

### Frontend files (built)

`web-app/src/`:
- `models/warehouseSchema.ts`, `models/warehouseJobRun.ts` (+ the
  `MAX_JOB_RETRIES = 3` constant, mirroring §9)
- `services/warehouseDataService.ts` — **hardcoded to the mock
  implementation for now**, unlike every other service: these two routes
  don't exist yet, so selecting "live" would always fail regardless of a
  developer's ambient `VITE_DATA_MODE`. `LiveWarehouseDataService` is
  defined and unit-tested as the target contract; restore the usual
  `config.dataMode === "live" ? … : …` selection once the backend ships.
- `hooks/useWarehouseSchema.ts` (no poll — schema changes are deploy-time),
  `hooks/useWarehouseJobRuns.ts` (30s poll, like pipeline status)
- `components/data/`: `WarehouseSchemaView.tsx`, `DataViewTabs.tsx`,
  `JobsView.tsx`, `JobRunFilters.tsx`, `JobRunHistoryTable.tsx`,
  `PerformanceView.tsx`, `warehouseJobStatusVisuals.ts` (reuses the
  pipeline status palette), `formatters.ts`
- `components/pages/DataPage.tsx`, route `/data` in `routes/AppRoutes.tsx`
- `test-data/warehouseSchema.ts`, `test-data/warehouseJobRuns.ts` — mock
  fixtures exercising every visual state (running, succeeded-with-stats,
  failed, resolved-by-retry, manual rebuild, retry-chain-exhausted)
- full mirrored tests under `web-app/tests/`; `npm run build` / `lint` /
  `test:coverage` all green, 100% per-file on every new file.

---

## 13. Repo Layout & `CLAUDE.md` Changes

```
cdk/
  warehouse/
    Nyc311WarehouseBucket.ts          # S3 landing-zone bucket
    Nyc311OrderEventsFirehose.ts      # SNS→Firehose, subscribes Nyc311OrderEventsTopic
    Nyc311OrderSnapshotsFirehose.ts   # SNS→Firehose, subscribes Nyc311OrderProjectionsTopic
    Nyc311RequestsFirehose.ts         # SNS→Firehose, subscribes Nyc311RequestEventsTopic
    Nyc311WarehouseCatalog.ts         # glue.CfnDatabase + glue.CfnTable ×3 + partition projection
    Nyc311AnalyticsWorkgroup.ts       # athena.CfnWorkGroup
    Nyc311WarehouseJobRunner.ts       # daily EventBridge Scheduler + Step Functions (§8/§9)
    Nyc311WarehouseRebuild.ts         # on-demand Step Functions (§10)
    sql/
      order_volume_by_borough.sql
```

No new fan-out Lambda file — §4 retrofits the two that already exist
(`cdk/lambda/Nyc311OrdersStreamFanOutLambda.ts`,
`cdk/lambda/Nyc311RequestsFanOutLambda.ts`, both renamed in place).

**`CLAUDE.md` changes:** §5.3's tree gains `warehouse/` under `cdk/`
(matches the `api/`/`web/` precedent — a new per-resource subfolder under
an already-unlocked directory, not a fresh unlock round). `.sql` files as
versioned assets under `cdk/warehouse/sql/` is flagged in Open Items as
still wanting explicit sign-off — the one genuine new-convention decision
in this doc. `business-insights.md` §3 gets a note that this doc
supersedes it for implementation detail.

---

## 14. Observability & Alarms

Structured logs + targeted alarms, no new `MetricFilter`s (7 of the
project-wide 10-custom-metric cap remain unspent by this build):

- Alarm on Firehose `DeliveryToS3.DataFreshness` exceeding ~2× the
  buffering interval, and on any object landing under `errors/`.
- The two renamed fan-out Lambdas keep their existing `Errors`/
  `IteratorAge` alarms from their pre-existing pipelines — no new alarm
  needed on the Lambdas themselves from this build.
- Step Functions `ExecutionsFailed` on both the daily job runner and the
  rebuild state machine; alarm on `WarehouseJobRuns` rows stuck `FAILED`
  past `MAX_JOB_RETRIES`.
- All alarms route to the existing `FAILURE_NOTIFICATION_EMAIL` SNS topic.

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
- **Job-runner Step Functions role:** `athena:StartQueryExecution`/
  `GetQueryExecution`/`GetQueryResults` scoped to the one workgroup;
  `glue:GetTable`/`GetDatabase`/`GetPartitions` on the one database;
  `s3:GetObject` on `data/*`, `s3:PutObject` on `athena-results/*`.
  Result-copy Lambda: `dynamodb:PutItem`/`BatchWriteItem` on
  `AnalyticsRollups` and `WarehouseJobRuns`.
- **Rebuild state machine role:** `sns:Subscribe`/`Unsubscribe` scoped to
  the three warehouse topics; `dynamodb:ExportTableToPointInTime`/
  `DescribeExport` on the three source table ARNs; `s3:DeleteObject`/
  `ListBucket` on `data/*`, `s3:GetObject`/`PutObject` on
  `export-staging/*`; `firehose:PutRecordBatch` on the three delivery
  streams; `dynamodb:PutItem` on `WarehouseJobRuns`.
- **`/data`'s two Lambdas — read-only, no exceptions:** the schema route
  gets `glue:GetTable`/`GetTables`/`GetDatabase` only; the jobs route gets
  `dynamodb:Query` on `WarehouseJobRuns` only. **Neither gets any
  `dynamodb:Put*`/`Update*`/`Delete*`, `states:StartExecution`, or
  `athena:StartQueryExecution`** — asserted absent in a CDK test, since
  §12's "no write actions" decision needs to hold at the IAM layer, not
  just "no button exists in the UI."

---

## 16. Cost

| Component | Cost |
|---|---|
| S3 storage | Cents/month. |
| Kinesis Firehose (×3) | Low single-digit dollars/month at most; likely cents. |
| Athena | $5/TB scanned — a daily job over this data volume is effectively free. |
| Glue Data Catalog | Free tier covers this outright. |
| SNS (3 topics) | Free tier covers this outright. |
| `WarehouseJobRuns` + `AnalyticsRollups` (DynamoDB, on-demand) | Cents/month at most. |
| Step Functions (daily runner + occasional rebuilds) | Rounding error at this execution frequency. |

**No new recurring infrastructure cost** — widening the two existing
fan-out Lambdas (§4) rather than adding a Kinesis Data Stream (Appendix
A.2) is the entire reason.

---

## 17. Testing

Same four-tier model (`testing-framework.md`):

- **Unit (Vitest, 90% per-file):** both widened fan-out
  controllers/services (relevance + routing per branch, `unmarshall`,
  `sns:Publish` shape); the result-copy controller/service/DAO; the
  job-run-tracking DAO/service (write-then-update lifecycle, the retry
  sweep, `MAX_JOB_RETRIES` cutoff); the rebuild's `WipePrefix`/
  `ReplayExportFiles` Lambdas; `warehouseSchemaService`/
  `warehouseJobRunsService` with the Glue/DynamoDB clients mocked.
- **CDK assertions:** bucket config; Firehose ×3 (buffering, Parquet
  conversion pointed at the right Glue table, delivery-role policy scoped
  — not `*`); `CfnDatabase`/`CfnTable` ×3 (partition-projection
  `parameters` map asserted directly — a typo there silently breaks every
  query); §6's schema-drift test itself; both job-runner and rebuild Step
  Functions definitions; `WarehouseJobRuns`/`AnalyticsRollups` key
  schema/GSIs; every Lambda's IAM, including an explicit assertion that
  `/data`'s two Lambdas carry no write actions.
- **Real integration:** `test-scripts/4-warehouse-test.py` (write a
  synthetic Order/OrderEvent, wait out the Firehose buffer, query Athena,
  assert the row appears) and `test-scripts/5-warehouse-rebuild.py`
  (§10). Not pipeline-blocking gates yet. The two `/data` GET routes do
  join `4-pipeline-integration-tests.md`'s real endpoint-coverage gate.
- **Frontend (built 2026-09-05):** full mirrored Vitest/RTL suite for
  every `/data` model, service, hook, and component — `warehouseDataService`'s
  mock-selection *and* `LiveWarehouseDataService`'s fetch/parse/error
  contract, the tab switch, the schema-collapsed default, the retry-chain
  and retries-exhausted rendering, the Performance view's metric-run
  filter and averages. `web-app` build/lint/`test:coverage` all green,
  100% per-file on every new file.

---

## 18. Naming Reference

| Piece | Name |
|---|---|
| S3 bucket | `nyc311-warehouse-<test\|prod>` |
| Glue database | `nyc311_warehouse_<test\|prod>` |
| Glue tables | `order_events`, `order_snapshots`, `requests` |
| Athena workgroup | `Nyc311Analytics-<Test\|Prod>` |
| Firehose (×3) | `Nyc311Warehouse-OrderEvents-<Test\|Prod>`, `…-OrderSnapshots-…`, `…-Requests-…` |
| Fan-out Lambdas | `Nyc311OrdersStreamFanOutLambda` (renamed from `Nyc311OrderEventFanOutLambda`), `Nyc311RequestsFanOutLambda` (renamed from `Nyc311OrderFanOutLambda`) |
| SNS topics (new) | `Nyc311OrderProjectionsTopic`, `Nyc311RequestEventsTopic` |
| Job run history table | `WarehouseJobRuns-<Test\|Prod>` |
| Serving table | `AnalyticsRollups-<Test\|Prod>` |
| Rebuild state machine | `Nyc311WarehouseRebuild-<Test\|Prod>` |
| Job runner state machine | `Nyc311WarehouseJobRunner-<Test\|Prod>` |
| SQL assets | `cdk/warehouse/sql/order_volume_by_borough.sql` |
| `/data` routes | `GET /data/schema`, `GET /data/jobs` |
| `/data` frontend | `web-app/src/models/{warehouseSchema,warehouseJobRun}.ts`, `services/warehouseDataService.ts`, `hooks/{useWarehouseSchema,useWarehouseJobRuns}.ts`, `components/data/*`, `components/pages/DataPage.tsx`, route `/data` (§12) |
| Integration scripts | `test-scripts/4-warehouse-test.py`, `test-scripts/5-warehouse-rebuild.py` |

---

## Build Checklist

Nothing below `§12` is built yet — the design is settled but the backend
and infrastructure are untouched. Tracked as legs, roughly in dependency
order.

### Frontend — `/data` page

- [x] Models, mock service (hardcoded), hooks, components, page, route,
      fixtures, full mirrored tests — **done 2026-09-05** (§12). Mock-only;
      hooks into the real routes with no change once they exist.
- [ ] Restore `config.dataMode`-gated service selection when
      `GET /data/schema` / `GET /data/jobs` are live.
- [ ] Add the two GET routes to `4-pipeline-integration-tests.md`'s
      endpoint-coverage gate.

### Leg 1 — change capture (§4)

- [ ] Rename `Nyc311OrderEventFanOutLambda` → `Nyc311OrdersStreamFanOutLambda`;
      widen it to route `#METADATA` → new `Nyc311OrderProjectionsTopic`.
- [ ] Rename `Nyc311OrderFanOutLambda` → `Nyc311RequestsFanOutLambda`;
      widen it to publish every real Request row to new
      `Nyc311RequestEventsTopic` (with `event_name` attribute), and move
      the ingestion queue onto a filtered SNS subscription
      (`{event_name: ["INSERT"]}`).
- [ ] Unit + CDK assertion tests for both (routing per branch, IAM =
      `sns:Publish` only, no `dynamodb:*` write).
- [ ] Ship and verify order evaluation / request promotion still work
      unchanged.

### Leg 2 — landing zone + catalog (§5–§7)

- [ ] `cdk/warehouse/Nyc311WarehouseBucket.ts` (§5 prefix layout).
- [ ] Three Firehoses, Parquet conversion against the Glue tables,
      subscribed to the three topics (§4).
- [ ] `Nyc311WarehouseCatalog.ts` — Glue database + three `CfnTable`s +
      partition projection (§7).
- [ ] `Nyc311AnalyticsWorkgroup.ts` (§8).
- [ ] `cdk/tests/warehouse/schemaSync.test.ts` — the drift-detection test
      (§6).
- [ ] `CLAUDE.md` §5.3 tree: add `cdk/warehouse/`.
- [ ] Verify data lands and is Athena-queryable in `Nyc311-Test`
      (`test-scripts/4-warehouse-test.py`).

### Leg 3 — job runner + tracking + serving (§8–§9, §11)

- [ ] `WarehouseJobRuns` table + DAO/service (write lifecycle, retry
      sweep, `MAX_JOB_RETRIES` cutoff) — `backend/{controller,service,dao}/analytics/`.
- [ ] `AnalyticsRollups` table + DAO + result-copy Lambda.
- [ ] `Nyc311WarehouseJobRunner` — EventBridge Scheduler (`rate(1 day)`) →
      Step Functions → Athena → result copy → `RecordJobRun`.
- [ ] `cdk/warehouse/sql/order_volume_by_borough.sql` — **blocked on the
      `Locations` pipeline** (Open Items); the runner and mechanism can
      ship against a placeholder query first.
- [ ] `GET /data/schema` + `GET /data/jobs` Lambdas + routes (read-only
      IAM, asserted no write actions).

### Leg 4 — on-demand rebuild (§10)

- [ ] `Nyc311WarehouseRebuild` state machine — per-source `Map`:
      unsubscribe Firehose → drain → wipe → resubscribe → pinned-`ExportTime`
      export → replay files through Firehose → `RecordJobRun`.
- [ ] `emptyWarehousePrefixController` + `ReplayExportFiles` Lambdas.
- [ ] `test-scripts/5-warehouse-rebuild.py`.
- [ ] Verify `ExportTime` can be pinned close to "now" (PITR's ~5-minute
      floor — Appendix A.6).

### Leg 5 — observability (§14)

- [ ] Firehose `DataFreshness` / `errors/` alarms; SFN `ExecutionsFailed`;
      stuck-`FAILED` alarm. Route to `FAILURE_NOTIFICATION_EMAIL`.

### Doc

- [ ] `business-insights.md` §3 — add the "superseded by
      `7-data-warehousing.md` for implementation detail" note.
- [ ] Resolve the remaining Open Items (`Locations`, `.sql`-asset
      sign-off).

---

## Open Items

- **`Locations`.** Explicitly deferred — no fan-out, no Firehose, no Glue
  table this round. Consequence named in §8: the sample job's `borough`
  join has nothing to join against until `Locations` lands, so
  `order_volume_by_borough.sql`'s first real run is blocked on this.
  Revisit once the Orders/OrderEvents/Requests pipeline is verified
  working end to end.
- **`/data` write actions.** No "retry"/"rebuild" button, no `POST`
  routes. Deferred until real role-gated auth exists
  (`2-pipeline-monitoring.md` §11's unbuilt `AuthenticatedRoute`) — not in
  scope for this doc. §10's rebuild stays script-triggered, under the
  `nyc311` profile, until then.
- **`.sql` files as versioned repo assets** (`cdk/warehouse/sql/`) — the
  one genuine new convention this doc introduces (no non-TS/non-doc
  source has existed in this repo before). Wants explicit sign-off before
  the first file lands.
- **`Cases`/`Operators`/`Shifts`.** Join this same pipeline once those
  tables are built — no redesign needed, per §3's design principle.
- **Every other `business-insights.md` §2 aggregation** (cost model, Case
  MTTR, SLA-breach rate) — stays designed-not-built; added later as more
  entries in the same job runner (§8), using `order_volume_by_borough` as
  the template.
- **Compaction / small-file consolidation** — not designed or built this
  round. §9's captured query-performance metrics (`data_scanned_bytes`,
  `engine_execution_time_ms`) exist specifically so this can be measured
  and reasoned about later (by a human or an agent) without new
  instrumentation, once it's worth doing.

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
