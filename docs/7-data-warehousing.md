# Data Warehousing — Orders/OrderEvents/Requests Into a Queryable SQL Store

> **Status: Legs 1–3 + the `/data` frontend shipped to `Nyc311-Prod`
> (2026-09-06). The serving layer was reworked 2026-09-07 — job results
> are resultsets in S3, not rows in a DynamoDB table** (see §8/§11 and
> Appendix A.10). Leg 4 (on-demand rebuild) shipped + verified 2026-09-09; Leg 5
> (observability) runs on OOTB metrics for now with the alarm suite
> deferred to [#25](https://github.com/seththeeke/nyc-311/issues/25) — see
> the [Build Checklist](#build-checklist).
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

**Explicitly out of scope** (see [Open Items](#open-items)):
`business-insights.md` §2's other aggregations, `Cases`/`Operators`/`Shifts`
(not built yet), and any write action on `/data`.

---

## 3. Data Sources

| Source | Warehouse table | Role |
|---|---|---|
| `Orders` table — `OrderEvent` items (`EVENT#<n>`) | `order_events` | Fact stream — every `ORDER_CREATED`/`ORDER_ACCEPTED`/`ORDER_REJECTED`/`ORDER_SCHEDULED`/… with `occurred_at`, `stage`, `actor`, `payload`. |
| `Orders` table — `#METADATA` projection | `order_snapshots` | Current-state dimension — `current_stage`, `status`, `location_id`, `sla_deadline`, `priority_tier`, etc. as plain typed columns. |
| `Requests` table — real `Request` rows | `requests` | Intake dimension + status CDC — `complaint_type`, `agency`, `created_at`, and every `DRAFT → PROMOTED/FILTERED/DUPLICATE/REJECTED` transition. |
| `Locations` table — real `Location` rows | `locations` | Geography dimension — `bbl`, `borough`, `zip`, `latitude`/`longitude`, joined to `order_snapshots`/`requests` on `location_id`. Written once per `bbl` (`findOrCreate`), never updated — `INSERT`-only. |

**Excluded, by design:** `Requests`' `METRIC#<ulid>` poller-metrics rows
and `CURSOR#NYC_311` sentinel (operational, already served by
`GET /ingestion/metrics`) — the widened fan-out Lambda's relevance check
(§4) filters these out before they ever reach a topic.

**Deferred:** `CaseEvent`/`Cases`, `OperatorEvent`/`Operators`/`Shifts`
(none of these tables exist yet). When any of them ship, each attaches to
this exact pipeline the same way — one more fan-out branch, one more
Firehose, one more Glue table — not a redesign.

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

## 8. Jobs & the Job Runner

**A job is `{ name, SQL }`** — a `.sql` file under `cdk/warehouse/sql/`.
The runner is generic: it does not know or care what any job's query
returns. It runs the SQL, stores the resultset verbatim, and appends it to
that job's history table. Presentation-specific shaping (which columns to
chart, how to render) lives entirely in the consumer, never here.

### The registered jobs

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

Every registered job runs daily; adding one is adding a `.sql` file.

### The runner: `Nyc311WarehouseJobRunner` (one Lambda, EventBridge `rate(1 day)`)

Not Step Functions (Appendix A.10): the queries scan kilobytes and return
in seconds — orchestration buys nothing, and a per-job SFN machine fights
the "add a job = add a `.sql` file" goal. One Lambda, `controller/analytics/
runWarehouseJobController.ts`, zod-parsed trigger, per `CLAUDE.md` §5.2.

Per invocation:

1. **Retry sweep** (§9) — re-run any job whose most recent run `FAILED`
   with `retry_count < MAX_JOB_RETRIES`, as a `RETRY` run.
2. **For each registered job**, isolated in its own try/catch so one
   failure never blocks the rest:
   a. Write a `RUNNING` `WarehouseJobRuns` row.
   b. `StartQueryExecution` / poll `GetQueryExecution` against the one
      workgroup; capture `Statistics` (`DataScannedInBytes`,
      `EngineExecutionTimeInMillis`, `QueryQueueTimeInMillis`) for §9.
   c. `GetQueryResults` → build the **self-describing resultset envelope**
      (§11) and `s3:PutObject` it to
      `job-results/job_name=<job>/run_date=<date>/result.json`, immutable.
      Athena hands every value back as a string, so envelope `rows` are
      string-valued; `columns[].type` carries the Athena type so any
      consumer can cast. A same-day retry overwrites that `run_date`
      partition's `result.json` (the later run wins — a retry corrects).
   d. Update the `WarehouseJobRuns` row to `SUCCEEDED`/`FAILED` with the
      stats, `result_location`, and `row_count`. This tracking write is
      its own try/catch — it never changes the outcome it describes.

That single `result.json` per run is *also* the history record: one Glue
table (`job_results`, §11) sits over the whole `job-results/` prefix with
partition projection on `(job_name, run_date)`, so "trend of trends" is a
plain Athena query with no second write, no CTAS, no `glue:CreateTable`.

The `.sql` files are read at synth (`fs.readFileSync`) and passed to the
Lambda as one `WAREHOUSE_JOBS` env var (a JSON `[{name, sql}]` manifest
built from the `sql/` directory) — no runtime S3/asset fetch.

---

## 9. Job Run Tracking & Automatic Retry

**Table: `WarehouseJobRuns-<env>`** (plain `Dao<T>`, not event-sourced).

| Field | Notes |
|---|---|
| `job_run_id` | PK. ULID. |
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
- `gsi1-recent-runs` — `gsi1pk = "JOB#RUNS"` (fixed constant), `gsi1sk =
  started_at`. Backs `/data`'s most-recent-first view.
- `gsi2-status` — `gsi2pk = status`, `gsi2sk = started_at`. Backs the
  retry sweep: `Query gsi2pk = "FAILED"`.

**Write path:** a `RUNNING` row at start, updated to `SUCCEEDED`/`FAILED`
at completion — every run recorded regardless of outcome. The tracking
write itself is wrapped in its own try/catch that only logs on failure,
never allowed to change the real outcome it's describing.

**Automatic retry:** at the start of each scheduled invocation, before
running the day's jobs, the runner checks — per registered job — whether
that job's most recent run `FAILED` with `retry_count < MAX_JOB_RETRIES`
(**3**), and if so re-runs it first as a `RETRY` row carrying
`previous.retry_count + 1`. (The `gsi2-status` `Query gsi2pk = "FAILED"`
is the general form; with a handful of registered jobs, "latest run per
job" via `gsi1-recent-runs` is what the code actually does.) Once
`MAX_JOB_RETRIES` is exhausted, a run stops being retried automatically
and shows as permanently failed on `/data` — no automatic Case creation.
Same Lambda/schedule as §8, not a second cron.

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
    Nyc311WarehouseCatalog.ts         # glue.CfnDatabase + glue.CfnTable ×5 (4 sources + job_results) + partition projection
    Nyc311AnalyticsWorkgroup.ts       # athena.CfnWorkGroup
    Nyc311WarehouseJobRunnerLambda.ts # generic runner Lambda (§8/§9)
    Nyc311WarehouseJobSchedule.ts     # daily EventBridge Scheduler + DLQ + failure alarm
    Nyc311Warehouse{Schema,Jobs}ApiLambda.ts, Nyc311JobResultApiLambda.ts   # three /data read routes (§12)
    Nyc311ReportsApiLambda.ts         # GET /reports — the centralized reporting surface (§12)
    Nyc311WarehouseRebuildLambda.ts   # the rebuild worker Lambda (§10, Leg 4)
    sql/
      order_volume_by_stage_7d.sql, order_volume_by_stage_8w.sql, order_volume_by_borough.sql
cdk/step-function/
  Nyc311WarehouseRebuildStateMachine.ts   # on-demand rebuild Step Functions (§10, Leg 4)
cdk/lambda/
  Nyc311LocationEventsTopic.ts, Nyc311LocationsFanOutLambda.ts   # §4, added 2026-09-07
```

`backend/`: `models/{warehouseJobRun,jobResult,warehouseJob,warehouseJobTrigger,locationStreamEvent,report,warehouseRebuild}.ts`,
`dao/analytics/warehouseJobRunsDao.ts`, `service/analytics/{warehouseJobRunnerService,
warehouseJobRunsService,warehouseSchemaService,jobResultService,reportsService,warehouseRebuildService,warehouseRecordTransformService}.ts`,
`service/ingestion/locationEventService.ts`,
`controller/analytics/runWarehouseJobController.ts`,
`controller/ingestion/fanOutLocationEventsController.ts`,
`controller/data-archival/warehouseRebuildController.ts`,
`controller/web-api/get{WarehouseSchema,WarehouseJobRuns,JobResult,Reports}Controller.ts`.
Rebuild adds the `@aws-sdk/client-firehose` dependency.
The 2026-09-07 rework deleted `dao/analytics/analyticsRollupsDao.ts`,
`models/analyticsRollup.ts`, `service/analytics/analyticsRollupsService.ts`,
`controller/web-api/getRollupsController.ts`, and the rollup-fold logic in
`warehouseJobRunnerService.ts`.

§4's Orders/Requests fan-out retrofits the two Lambdas that already exist
(renamed in place); the Locations fan-out is a genuinely new Lambda
(there was no prior `Locations` stream consumer).

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
  runner never touches the catalog); `s3:GetObject` on `data/*`,
  `s3:PutObject`/`GetObject` on `job-results/*`, `s3:PutObject`/
  `GetObject`/`DeleteObject` on `athena-results/*`;
  `dynamodb:GetItem`/`PutItem`/`Query` on `WarehouseJobRuns`. No
  `AnalyticsRollups` — it no longer exists; no Glue writes.
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
| Lambda (daily runner + the three read routes) | Free tier covers it. |
| Step Functions (occasional rebuilds only, §10) | Rounding error. |

**No new recurring infrastructure cost** — widening the two existing
fan-out Lambdas (§4) rather than adding a Kinesis Data Stream (Appendix
A.2) is the entire reason.

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
| Glue source tables | `order_events`, `order_snapshots`, `requests`, `locations` |
| Athena workgroup | `Nyc311Analytics-<Test\|Prod>` |
| Firehose (×4) | `Nyc311Warehouse-OrderEvents-<Test\|Prod>`, `…-OrderSnapshots-…`, `…-Requests-…`, `…-Locations-…` |
| Fan-out Lambdas | `Nyc311OrdersStreamFanOutLambda`, `Nyc311RequestsFanOutLambda`, `Nyc311LocationsFanOutLambda` (+ their `…FanOutDlq-<Test\|Prod>` queues) |
| SNS topics | `Nyc311OrderProjectionsTopic`, `Nyc311RequestEventsTopic`, `Nyc311LocationEventsTopic` (physical `Nyc311<Order Projections\|RequestEvents\|LocationEvents>-<Test\|Prod>`) |
| Job run history table (DynamoDB) | `WarehouseJobRuns-<Test\|Prod>` |
| Job result store (S3) | `s3://nyc311-warehouse-<test\|prod>/job-results/job_name=<job>/run_date=<date>/result.json` |
| Job history table (Glue/Athena) | `nyc311_warehouse_<test\|prod>.job_results` (one table, `rows array<map<string,string>>`, over the whole `job-results/` prefix) |
| Rebuild state machine / worker Lambda | `Nyc311WarehouseRebuild-<Test\|Prod>`, `Nyc311WarehouseRebuildWorker-<Test\|Prod>` (Leg 4); ARN in the `Nyc311WarehouseRebuildStateMachineArn` stack output; export staging under `s3://…/export-staging/<source>/` |
| Job runner Lambda / schedule | `Nyc311WarehouseJobRunner-<Test\|Prod>`, `Nyc311WarehouseJobSchedule-<Test\|Prod>` |
| Reports API Lambda | `Nyc311ReportsApi-<Test\|Prod>` |
| SQL assets | `cdk/warehouse/sql/order_volume_by_stage_7d.sql`, `order_volume_by_stage_8w.sql`, `order_volume_by_borough.sql` |
| `/data` routes | `GET /data/schema`, `GET /data/jobs`, `GET /data/jobs/{name}/result` |
| `/reports` route | `GET /reports` (§12) |
| `/data` frontend | `web-app/src/models/{warehouseSchema,warehouseJobRun,jobResult}.ts`, `services/warehouseDataService.ts`, `hooks/{useWarehouseSchema,useWarehouseJobRuns,useJobResult}.ts`, `components/data/*`, `components/pages/DataPage.tsx`, route `/data` (§12) |
| `/reports` frontend | `web-app/src/models/report.ts`, `services/reportsService.ts`, `hooks/useReports.ts`, `components/reports/ReportTrendTable.tsx`, `components/pages/ReportsPage.tsx`, route `/reports` (§12) |
| Integration scripts | `test-scripts/4-warehouse-test.py`, `test-scripts/5-warehouse-rebuild.py` (Leg 4) |

---

## Build Checklist

Legs 1–3 shipped 2026-09-06; Leg 3.5 (reporting-substrate rework) +
Monitoring tile 2026-09-07; Locations + Reports 2026-09-07 (verified
2026-09-08); Leg 4 (on-demand rebuild) shipped 2026-09-08, verified
2026-09-09. **The warehouse build is complete.** Leg 5's alarm suite is
deferred to [#25](https://github.com/seththeeke/nyc-311/issues/25); new
`.sql` jobs land as the domain grows (biz-intel-agent, [#24](https://github.com/seththeeke/nyc-311/issues/24)).
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
  — an agent that owns job authoring (new `.sql` on business request or
  autonomously), their surfacing, retirement, and Athena/Glue efficiency;
  replaces standing BI work. Deferred until `Cases`/`Operators`/`Shifts`
  land and `/reports` is established.
- **User-authored SQL jobs / ad-hoc query API.** The substrate framing
  (§1) points here: users defining `{ name, SQL }` jobs, or running one-off
  queries, through the app. Out of scope now — needs job CRUD, SQL
  validation/sandboxing, per-user auth, and per-query cost controls
  (`bytesScannedCutoffPerQuery` on the workgroup is the only piece that
  exists). Jobs stay checked-in `.sql` files until then.
- **`/data` write actions.** No "retry"/"rebuild" button, no `POST`
  routes. **Deferred indefinitely** — would need real role-gated auth
  (`2-pipeline-monitoring.md` §11's unbuilt `AuthenticatedRoute`). §10's
  rebuild stays script-triggered under the `nyc311` profile.
- **`Cases`/`Operators`/`Shifts`.** Join this same pipeline once those
  tables are built — no redesign needed, per §3's design principle.
- **Every other `business-insights.md` §2 aggregation** (cost model, Case
  MTTR, SLA-breach rate) — designed-not-built; each is another `.sql`
  file. On hold until more of the domain exists; then biz-intel-agent
  ([#24](https://github.com/seththeeke/nyc-311/issues/24)) owns them.
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
