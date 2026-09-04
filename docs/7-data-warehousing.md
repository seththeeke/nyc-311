# Data Warehousing — Consuming the Event Streams into a Queryable SQL Store

> ⚠️ **STATUS: WORK IN PROGRESS (draft, 2026-09-04).** Nothing in this doc
> is decided. It's a first-pass design laid out for negotiation — every
> topic is `Proposed`, and the six forks in "Open forks to resolve before
> building Slice A" (bottom) still need the project owner's call. Do not
> build against this yet.

> Negotiated starting **2026-09-04**, same progressive/question-by-question
> style as `5-order-evaluation.md` / `6-order-scheduling.md`. This doc
> designs the paradigm that consumes the app's change/event streams
> (`Requests`, `Order`/`OrderEvent`, and everything that joins them later)
> and lands them in an S3 + Athena data lake that can be queried on demand
> with SQL to build larger-scale reports.
>
> **This is the implementation-level revisit of `business-insights.md` §3
> ("Analytics Infrastructure").** That section already made the top-level
> engine calls — **S3 + Athena, not Redshift** (§3.2); **Kinesis Firehose
> for landing** (§3.3); **manual Glue DDL, no crawler** (§3.5);
> **EventBridge Scheduler → Step Functions → Athena** for job
> orchestration (§3.4); **pre-aggregated results copied into dedicated
> DynamoDB tables** for the dashboard API to read (§3.6). Those decisions
> carry forward unless a topic below explicitly reopens one. What this doc
> adds is everything §3 left as a diagram or an `[OPEN]`: the actual
> mechanism to get change data off DynamoDB, the S3 layout, the catalog
> DDL and how it's deployed, backfill, and where all of it lives in the
> repo.
>
> **`business-insights.md` §3 is also partly stale and this doc supersedes
> it where they conflict:**
> - §3.1's pipeline diagram lists `OrderEvent, ShiftEvent, CaseEvent`
>   streams. `ShiftEvent` no longer exists (`Shift` became a plain record,
>   `data-model.md`); the `Cases`, `Operators`, and `Shifts` tables aren't
>   built yet. The only real event stream today is `OrderEvent` (the
>   `Orders` table), plus row-level change capture on `Requests`.
> - §3.1/§3.3 draw "DynamoDB Streams → Kinesis Data Firehose → S3" as a
>   single arrow. Firehose has **no native DynamoDB Streams source** (its
>   sources are Direct PUT, a Kinesis Data Stream, or MSK) — there is
>   always a hop in between, and §4 below is where that hop gets decided.
> - The `Nyc311OrderEventsTopic` SNS fan-out (`5-order-evaluation.md` §3)
>   didn't exist when §3 was written — it's now a candidate tap point that
>   changes the §4 tradeoff.
>
> `backend/`/`cdk/` are already unlocked (`CLAUDE.md` §5.1/§5.2). A new
> `cdk/` subdirectory and a new **non-TypeScript asset type** (`.sql`
> files) are proposed in §10 — that part is a structure decision, not just
> a build.

---

## Decision Status

Negotiated **question by question**. Nothing below is decided yet — this
table is the proposed shape of the conversation, open to
reordering/splitting/merging.

| Topic | Status |
|---|---|
| [1. Scope & slicing](#1-scope--slicing) | **Proposed** |
| [2. Source selection — what gets warehoused](#2-source-selection--what-gets-warehoused) | **Proposed** |
| [3. The stream tap — getting change data off DynamoDB](#3-the-stream-tap--getting-change-data-off-dynamodb) | **Proposed** |
| [4. Landing zone — S3 bucket, layout, file format](#4-landing-zone--s3-bucket-layout-file-format) | **Proposed** |
| [5. Schema & catalog — Glue database, tables, DDL deployment](#5-schema--catalog--glue-database-tables-ddl-deployment) | **Proposed** |
| [6. Backfill — seeding history from existing table data](#6-backfill--seeding-history-from-existing-table-data) | **Proposed** |
| [7. Transformation & job orchestration](#7-transformation--job-orchestration) | **Proposed** |
| [8. Serving layer — aggregate tables & the dashboard API](#8-serving-layer--aggregate-tables--the-dashboard-api) | **Proposed** |
| [9. Where it lives — stack, repo layout, CLAUDE.md](#9-where-it-lives--stack-repo-layout-claudemd) | **Proposed** |
| [10. Observability & alarms](#10-observability--alarms) | **Proposed** |
| [11. IAM & least privilege](#11-iam--least-privilege) | **Proposed** |
| [12. Cost](#12-cost) | **Proposed** |
| [13. Testing](#13-testing) | **Proposed** |
| [14. Naming reference](#14-naming-reference) | **Proposed** |

---

## 1. Scope & slicing

`business-insights.md` §4 already deferred "the actual SQL for each metric"
to "once real event data exists to test against." That naturally splits
this work into two slices, and **this doc proposes to fully design and
build only the first**:

- **Slice A — the lake (this build).** Change/event data flows off every
  relevant DynamoDB table into a partitioned S3 landing zone, catalogued
  in Glue, and **ad-hoc queryable in Athena** (console or CLI) the moment
  it lands. Includes the one-time backfill of existing table data (§6).
  Exit condition: `SELECT * FROM order_events WHERE dt = current_date`
  returns real rows in `Nyc311-Test`.
- **Slice B — the scheduled reports (later doc, `8-*.md`).** The
  EventBridge → Step Functions → Athena job runner (§7), the actual
  aggregation SQL (`business-insights.md` §2's cost model, MTTR,
  SLA-breach rate, borough/complaint-type breakdowns), the DynamoDB
  serving tables (§8), and the dashboard API + web-app tiles that read
  them.

Rationale for the split: §7's and §8's shape genuinely depends on what the
data looks like once it's queryable — column cardinality, `payload` JSON
consistency across event types, how much history the backfill actually
recovers. Building the job runner and serving tables against a lake that
doesn't exist yet would be the same speculative-code trap
`3-order-ingestion.md`/`5-order-evaluation.md`/`6-order-scheduling.md` all
avoided with their stub-first approach.

**Topics 7 and 8 below are still specified** — enough to confirm the Slice
A design doesn't paint them into a corner — just not built this round.

**Fork to confirm:** is Slice A alone the right cut, or do you want at
least one real end-to-end aggregation (e.g. daily order volume by
borough) landing in a serving table as part of this build, to prove the
whole pipeline rather than just the front half?

---

## 2. Source selection — what gets warehoused

Every table that carries analytically-meaningful state, mapped to what it
contributes:

| Source | Today | Warehouse role | In Slice A? |
|---|---|---|---|
| `Orders` — `OrderEvent` items (`EVENT#<n>`) | Built, real data flowing | **Fact stream.** The analytical core — every `ORDER_CREATED`/`ORDER_ACCEPTED`/`ORDER_REJECTED`/`ORDER_SCHEDULED`/… with `occurred_at`, `stage`, `actor`, `payload`. MTTR, time-in-stage, funnel, defect rate all derive from here. | **Yes** |
| `Orders` — `#METADATA` projection | Built | **Order dimension / current-state snapshot.** Convenient for "current status" joins without folding events in SQL. Debatable — see fork below. | **Yes (proposed)** |
| `Requests` — real `Request` rows | Built, ~42k+ in Test | **Intake dimension + status CDC.** `complaint_type`, `agency`, `created_at`, and the `DRAFT → PROMOTED / FILTERED / DUPLICATE / REJECTED` transitions (intake funnel, promotion rate). Needs `MODIFY` capture, not just `INSERT`. | **Yes** |
| `Locations` | Built | **Geography dimension.** `borough`, `community_board`, `zip`, lat/long — the join target for every "by borough" breakdown in `business-insights.md` §2.3. Low volume, rarely changes. | **Yes** |
| `Requests` — `METRIC#<ulid>` poller rows | Built | Already served by `GET /ingestion/metrics`. No warehouse need. | No |
| `Requests` — `CURSOR#NYC_311` sentinel | Built | Operational, not analytical. | No |
| `CaseEvent` / `Cases` | **Not built** | Case MTTR, auto-resolve vs. escalation rate, agent confidence (`business-insights.md` §2.1). | No — joins the pipeline the same way when that table ships |
| `OperatorEvent` / `Operators`, `Shifts` | **Not built** | The entire §1 cost model (labor/transit/idle cost) depends on these. | No — same |

**Design principle to lock:** when `Cases`/`Operators`/`Shifts` tables are
eventually built, they attach to this exact pipeline with no redesign —
one more source config entry (§3), one more Glue table (§5), one more
backfill export (§6). This doc builds the paradigm; those are increments.

**Fork — the Order projection snapshot:** worth landing, or is it
redundant? Arguments for landing it: an at-`dt` snapshot of every Order's
current stage/status/`case_id`/`assigned_operator_id` makes a lot of
report queries a simple filter instead of an event-fold CTE, and it's the
only place `sla_deadline`/`priority_tier` live as columns. Against: it's
strictly derivable from `order_events`, so it's duplicated data that can
drift, and Athena event-folding isn't that painful. Recommendation: **land
it** — cheap, and Slice B's SQL is materially simpler with it.

---

## 3. The stream tap — getting change data off DynamoDB

The core Slice A decision. Four real options, and a hard constraint that
rules on them:

**Constraint — the DynamoDB Streams 2-consumer ceiling.** AWS recommends
**no more than two simultaneous consumers per stream shard**; a third
sees elevated throttling. Both streams we'd tap are already at **one**
consumer:
- `Orders` stream → `Nyc311OrderEventFanOutLambda` (→ `Nyc311OrderEventsTopic`)
- `Requests` stream → `Nyc311OrderFanOutLambda` (→ `Nyc311OrderIngestionQueue`)

So a warehouse tap that reads either DynamoDB Stream directly consumes the
**last** free slot on it. Any future consumer (a live-updates websocket
feed, a second analytics path) then has nowhere to go. This pushes toward
either reusing an existing fan-out or switching the change-capture
transport entirely.

### Option A — reuse the SNS fan-out for Orders, dedicated fan-out for Requests

- **OrderEvents:** add an **SNS → Firehose subscription** on the existing
  `Nyc311OrderEventsTopic` (native integration, no filter policy = every
  event). Zero new DynamoDB Stream consumers — the topic was explicitly
  designed for exactly this ("a future consumer subscribes with its own
  filter policy against the same topic, no fan-out Lambda change
  required", `5-order-evaluation.md` §3). The fan-out already `unmarshall`s
  `NewImage` to plain JSON — perfect for immutable event items.
- **Requests:** no topic exists, and the existing Requests fan-out is
  `INSERT` + `external_unique_key`-only (it drops the `MODIFY`s that carry
  status transitions). Add a **dedicated `Nyc311WarehouseRequestFanOut`
  Lambda** as the Requests stream's 2nd (final) consumer — forwards every
  `INSERT`/`MODIFY` real-Request row image (unmarshalled) to Firehose via
  Direct PUT, skipping the `METRIC#`/`CURSOR#` sentinels.
- `Locations` has no stream; see backfill (§6) + note below.
- **Pro:** least new infra for the Orders half; consistent with the
  project's hand-rolled-fan-out precedent for the Requests half.
- **Con:** two different mechanisms; still spends the Requests stream's
  last consumer slot; `Locations` change capture is unsolved (rare, so
  maybe fine — re-export periodically).

### Option B — EventBridge Pipes: DynamoDB Stream → Pipes → Firehose

One `CfnPipe` per table (`aws-cdk-lib/aws-pipes` L1 — the `-alpha` L2
isn't installed and isn't needed). Fully managed, no Lambda code,
built-in filtering (drop sentinels declaratively) and light enrichment.
- **Pro:** no handler code to test/maintain; the modern AWS-blessed shape
  for stream→target plumbing.
- **Con:** a Pipe **is** a stream consumer — same ceiling problem as
  reading the stream with a Lambda. First use of Pipes in this project
  (new mental model, L1-only in CDK at the pinned version).

### Option C — dedicated warehouse fan-out Lambda per stream → Firehose Direct PUT

The uniform version of Option A: one `Nyc311Warehouse*FanOut` Lambda on
each stream, each a thin `controller → service` (no DAO — pure plumbing,
same "full layering even with nothing to reach" precedent as the other
fan-outs), Direct PUT to a per-source Firehose.
- **Pro:** total control over record shaping (flatten, stamp
  `warehouse_ingested_at`, split `payload` out); one consistent pattern;
  matches every other fan-out in the repo.
- **Con:** most code to build/test; still spends both streams' last
  consumer slot.

### Option D — switch the tables to also emit a Kinesis Data Stream

`TableV2` supports a `kinesisStream` **alongside** `dynamoStream` (they're
independent — adding one doesn't touch or replace the other, confirmed
additive like the GSI-add in `1-data-ingestion.md`'s addendum). Firehose
consumes a Kinesis Data Stream **natively** — no Lambda, no Pipes, no
hop. Kinesis Data Streams also has **no 2-consumer ceiling** (5
shared-throughput consumers, or 20 with enhanced fan-out).
- **Pro:** permanently removes the consumer-ceiling problem for the whole
  project; least ongoing code (zero handlers); the one option that
  cleanly scales to "many future analytics/live consumers."
- **Con:** a Kinesis Data Stream carries a small always-on cost (~$11/mo
  per shard on-demand… actually on-demand Kinesis is ~$0.04/hr ≈ $30/mo —
  **the one genuinely non-trivial recurring cost in this whole design**,
  vs. ~$0 for the Lambda/Pipes options at this volume). Records land as
  DynamoDB's Kinesis record format (needs the same unmarshalling, done in
  a Firehose transformation Lambda or at query time).

### Recommendation

**Option A** for Slice A — it's the smallest build that ships, reuses the
SNS topic that was designed to be reused, and defers the cost question.
Flag **Option D** explicitly as the migration target the first time a
*third* consumer is wanted on either stream, or when `Cases`/`Operators`/
`Shifts` arrive and the number of streams-to-tap triples — at that point
the per-stream fan-out sprawl of A/C stops being worth avoiding a
$30/mo Kinesis stream.

**Firehose config (all options):** one delivery stream **per source
table** (not one shared) — independent buffering, independent error
prefixes, independent Glue schema. Buffering hint **64 MB / 300 s** (this
project's volume never fills 64 MB, so 300 s is the real flush cadence —
a report that's 5 minutes stale is completely fine; tighter buffering
just makes more tiny S3 objects). Dynamic partitioning by ingest date
(§4). Firehose-native JSON→Parquet conversion — see §4 fork.

---

## 4. Landing zone — S3 bucket, layout, file format

**Bucket:** one per environment — `nyc311-warehouse-test` /
`nyc311-warehouse-prod` (`CLAUDE.md` §5.3 env-suffix, lowercase per S3
naming). `RemovalPolicy.RETAIN`, versioning off (Firehose objects are
write-once), SSE-S3, `blockPublicAccess: BLOCK_ALL`, `enforceSSL: true`.
A lifecycle rule transitioning `raw/` to Glacier Instant Retrieval after
180 days is proposed but low-stakes at this data size.

**Prefix layout:**

```
s3://nyc311-warehouse-<env>/
  raw/
    order_events/dt=2026-09-04/<firehose-object>.parquet
    order_snapshots/dt=2026-09-04/...
    requests/dt=2026-09-04/...
    locations/dt=2026-09-04/...
  backfill/                    # one-time DynamoDB export-to-S3 (§6)
    order_events/...
    requests/...
    locations/...
  athena-results/              # Athena query output (Slice B), own lifecycle: expire after 30d
  errors/
    order_events/<firehose-error-output>/...
```

- **Partition key: `dt` (ingestion date, `YYYY-MM-DD`), single level.**
  Not `event_date` / `created_date` — Firehose partitions by processing
  time, and a single flat date partition is all Athena partition
  projection (§5) needs. Deeper partitioning (by `complaint_type`,
  `borough`) was considered and rejected: high-cardinality, and the data
  volume never justifies it — a full-day scan here is kilobytes to low
  megabytes.
- `backfill/` is a **sibling prefix, not a `dt=` partition**, so the
  catalog can expose it as either a separate table or a unioned external
  location without a fake date.

**File format fork — Parquet vs. JSON.gz:**

- **Firehose-native Parquet conversion** (`business-insights.md` §3.3's
  stated intent): columnar, Athena scans less, but Firehose's converter
  **requires a fixed Glue table schema at delivery time** and chokes on
  schema drift. `OrderEvent.payload` and `Request.raw_payload` are
  genuinely variable-shape JSON blobs — those columns must be typed as
  `string` and parsed with `json_extract` in SQL regardless (see §5).
- **JSON.gz landing, no conversion:** dead simple, tolerates any drift,
  Athena reads it fine. Costs more bytes scanned — irrelevant at this
  volume.
- **Recommendation: Firehose-native Parquet**, *with every variable blob
  (`payload`, `raw_payload`) as a `string` column*. Gets the columnar
  win for the stable top-level fields (the ones every report filters on —
  `event_type`, `occurred_at`, `stage`, `status`) while the messy nested
  data rides along as opaque JSON text. If drift causes real pain in
  practice, JSON.gz is a Firehose-config-only fallback, no pipeline
  redesign.

---

## 5. Schema & catalog — Glue database, tables, DDL deployment

`business-insights.md` §3.5 locked **manual DDL, no Glue crawler**, and
left the deployment mechanism `[OPEN]`. Closing it:

**Deployment mechanism: CDK `glue.CfnDatabase` + `glue.CfnTable` (L1
constructs, in `aws-cdk-lib/aws-glue` — no alpha package).** The table
schema *is* infrastructure — versioned, reviewed in the same PR as the
Firehose that writes to it, asserted in CDK tests. Rejected alternatives:
a one-off `CREATE EXTERNAL TABLE` run in the Athena console (invisible to
source control), and a custom-resource/migration Lambda that runs DDL
(more moving parts than a declarative `CfnTable` for a schema that
changes rarely). This keeps "author and verify the SQL/schema directly"
(§3.5's actual requirement) — the `CfnTable` column list *is* the
authored schema, just expressed in CDK.

**Database:** `nyc311_warehouse_<env>` (Glue database names can't take a
hyphen).

**Tables** (`raw` prefix locations from §4), one per source:

| Table | Stable typed columns | Opaque columns |
|---|---|---|
| `order_events` | `order_id`, `sequence_number` (bigint), `event_type`, `stage`, `occurred_at` (timestamp), `actor` | `payload` (string, JSON) |
| `order_snapshots` | `order_id`, `current_stage`, `status`, `priority_tier`, `sla_deadline` (timestamp), `scheduled_start`/`_end`, `assigned_operator_id`, `case_id`, `request_id`, `location_id`, `last_event_sequence` (bigint), `created_at`/`updated_at` | `retry_counts` (string, JSON map) |
| `requests` | `request_id`, `source`, `external_unique_key`, `location_id`, `complaint_type`, `descriptor`, `agency`, `status`, `created_at` | `raw_payload` (string, JSON) |
| `locations` | `location_id`, `bbl`, `borough`, `community_board`, `zip`, `latitude` (double), `longitude` (double), `created_at` | — |

Plus a Firehose-stamped `warehouse_ingested_at` (timestamp) on every row,
and the DynamoDB Streams `eventName` (`INSERT`/`MODIFY`/`REMOVE`) on
`requests`/`order_snapshots` so status-transition CDC is reconstructable
(the newest `MODIFY` per `request_id` on a given day is that request's
end-of-day state).

**Partitions:** **Athena partition projection** (`projection.enabled = true`,
`projection.dt.type = date`, `projection.dt.range = 2026-09-01,NOW`,
`storage.location.template = s3://…/raw/<table>/dt=${dt}/`). No
`MSCK REPAIR`, no `ALTER TABLE ADD PARTITION` job, no crawler — the table
"just knows" its partitions by convention. Consistent with §3.5's
no-crawler decision and this project's dislike of standing maintenance
jobs.

**Schema drift handling:** a new top-level field on an event/row that
isn't in the `CfnTable` column list is simply not queryable until the
column is added (a one-line CDK change + redeploy) — it's still in the
S3 object, not lost. Removing/renaming a column is the only breaking
change and requires a deliberate migration. Acceptable — schema changes
here are rare and always accompany a `data-model.md` change anyway.

---

## 6. Backfill — seeding history from existing table data

Streams/SNS only capture go-forward. Real history already exists:
- `Orders-Test` — every Order/OrderEvent since `3-order-ingestion.md`
  shipped (2026-08-22).
- `Requests-Test` — 42k+ rows, mostly `DRAFT`.
- `Locations-Test` — every resolved location.

**Mechanism: DynamoDB's native point-in-time export to S3.** Both tables
have PITR enabled (`ddb-design.md`), which is the only prerequisite.
`ExportTableToPointInTime` writes the full table as JSON (or ION) to a
chosen S3 prefix with **zero read-capacity impact** and no custom code —
it reads from the PITR backup, not the live table. Land it under
`backfill/<table>/` (§4).

- **Not a Scan-based export Lambda** — a `Scan` of 42k+ items burns real
  RCU and needs pagination/retry code; the native export is purpose-built
  for exactly this and is a single CLI call (or a CDK custom resource if
  we want it repeatable).
- **Catalog it as a separate Glue table per source** (`order_events_backfill`,
  etc.) pointing at `backfill/…`, rather than trying to make the export's
  output masquerade as a `dt=` partition of the live table. Slice B's SQL
  does `SELECT … FROM order_events UNION ALL SELECT … FROM order_events_backfill`
  where it wants full history. Keeps the live table's partition projection
  clean and makes "how much did the backfill actually recover" an
  explicit, inspectable thing.
- **One-time, manual, under the Deploy Safety Gate** (it's an AWS
  mutation — creates an export job + writes S3). Run once per environment
  after the Glue tables exist. Re-runnable if the first pass has gaps.

**Fork:** is the `Requests` backfill worth it? 42k rows of mostly-`DRAFT`
intake that never became Orders is real intake-funnel signal (denominator
for promotion rate), but it's also the backlog `3-order-ingestion.md` §6
explicitly stranded. Recommendation: **yes, export it** — it's the same
one CLI call, and "N requests ingested, M promoted" is a headline number.

---

## 7. Transformation & job orchestration *(Slice B — specified, not built)*

Carries `business-insights.md` §3.4 forward: **EventBridge Scheduler →
Step Functions → Athena**, mirroring the poller's scheduled-job precedent.

- **Athena via the direct Step Functions service integration**
  (`aws-stepfunctions-tasks.AthenaStartQueryExecution` +
  `AthenaGetQueryExecution` poll loop) — **no Lambda, no `backend/`
  controller** for the query-execution step itself. The SQL is the unit
  of work, not TypeScript.
- **The result-copy step IS a `backend/` controller** —
  `controller/data-archival/` (the directory `CLAUDE.md` §5.2 already
  names for archival callbacks/fetching) or a new `controller/analytics/`:
  a Step-Functions-invoked Lambda that reads an Athena result set and
  writes it into the DynamoDB serving table(s) (§8) via a new DAO. Enters
  through a controller with a zod-parsed trigger model, per §5.2.
- **Where the `.sql` files live** is the open structure question — see §9.
- **Aggregations** (`business-insights.md` §2): cost model (needs
  `Operators`/`Shifts` — blocked until those exist), Order resolution time
  / Case MTTR, resolution-time SLA-breach rate, all broken down by
  complaint type and borough (§2.3). Written as `CTAS`/`INSERT INTO`
  against the raw + backfill tables. **Authored by the project owner, not
  generated** (§3.4).
- **Cadence:** daily is almost certainly enough (`business-insights.md`'s
  metrics are all daily/period rollups). Hourly if a fresher public
  dashboard matters. TBD in Slice B.

---

## 8. Serving layer — aggregate tables & the dashboard API *(Slice B — specified, not built)*

`business-insights.md` §3.6: each job's small pre-aggregated output is
copied into a **dedicated DynamoDB table**, and the dashboard API reads
DynamoDB exactly like every other read path — no per-view Athena query
cost or latency.

- **Proposed shape: one `AnalyticsRollups-<env>` table**, PK =
  `metric_view` (e.g. `"ORDER_VOLUME_BY_BOROUGH"`), SK = the dimension +
  period key (e.g. `"2026-09-04#QUEENS"`). One table, many views, same
  single-table discipline as the rest of `ddb-design.md`. Alternative: a
  table per view — more tables, simpler items, no real upside here.
- New DAO under `backend/dao/` (a plain `Dao<T>`, not event-sourced),
  new `service/analytics/`, new `controller/web-api/` GET route(s), new
  web-app service/hook/page tiles — all the same pattern as
  `GET /ingestion/metrics` and `GET /orders`.
- Route(s) participate in `4-pipeline-integration-tests.md`'s
  endpoint-coverage gate like every other public GET.

---

## 9. Where it lives — stack, repo layout, CLAUDE.md

**Stack: `Nyc311Stack`, per-environment** (deployed as `Nyc311-Test` /
`Nyc311-Prod`) — **not** `Nyc311PipelineStack`. The warehouse data is
genuinely per-environment (Test's events vs. Prod's events must not
commingle), exactly the reasoning `2-pipeline-monitoring.md` §2 used in
reverse. The single-stack rule (`CLAUDE.md` §5.3) is satisfied — this is
application data infrastructure.

**Proposed `cdk/` layout** (per-resource constructs, same convention as
`lambda/`, `data/`, `api/`, `web/`):

```
cdk/
  warehouse/
    Nyc311WarehouseBucket.ts        # the S3 landing-zone bucket
    Nyc311OrderEventsFirehose.ts    # SNS→Firehose (Option A) or KDS→Firehose (Option D)
    Nyc311RequestsFirehose.ts
    Nyc311WarehouseRequestFanOut.ts # Requests-stream tap Lambda (Option A/C)
    Nyc311WarehouseCatalog.ts       # glue.CfnDatabase + glue.CfnTable ×N + partition projection
    Nyc311AnalyticsWorkgroup.ts     # athena.CfnWorkGroup (results location, bytes-scanned cutoff)
    sql/                            # Slice B: .sql query assets (CTAS/INSERT INTO)
      order_volume_by_borough.sql
      ...
```

**`CLAUDE.md` changes needed:**
- §5.3 tree: add `warehouse/` under `cdk/` (matches the `api/` precedent —
  `1-data-ingestion.md`'s addendum established a new per-resource `cdk/`
  subfolder doesn't need a fresh unlock round, just a tree update).
- **New, genuine structure decision: `.sql` files as first-class
  versioned assets.** The repo has never held non-TS/non-doc source
  before. Proposed home is `cdk/warehouse/sql/` (co-located with the
  construct that deploys them as `s3-assets` / inlines them into the SFN
  definition). Alternative: `backend/` (but they're not TS and don't fit
  controller/service/dao), or `docs/` (freeform, but these are executable
  artifacts, not docs). Wants explicit sign-off — this is the one part of
  the doc that's a real convention change, not an extension.

**`business-insights.md` §3** gets a "superseded by `7-data-warehousing.md`
for implementation detail; stale `ShiftEvent` reference" note, same way
`ddb-design.md`'s "Still Open" already flags that doc's staleness.

---

## 10. Observability & alarms

Same restraint as `5-order-evaluation.md` §7 / `6-order-scheduling.md` §9
— **structured logs + a few targeted CloudWatch alarms, no new
`MetricFilter`s** (7 of the project-wide 10-custom-metric cap remain;
none spent here — the warehouse's health is binary "is data landing,"
not a rate worth a time series).

- **Firehose delivery failure** — alarm on `DeliveryToS3.DataFreshness`
  exceeding ~2× the buffering interval, and on any object landing under
  `errors/` (S3 error-output prefix). A stuck Firehose means reports
  silently freeze with no other signal — same reasoning as the fan-out
  `IteratorAge` alarm in `3-order-ingestion.md` §2.3.
- **Fan-out Lambda** (Option A/C) — `Errors` / `IteratorAge`, identical
  shape to the existing `Nyc311OrderPipelineAlarms`.
- **Slice B:** Step Functions `ExecutionsFailed` on the job runner; the
  result-copy Lambda's DLQ depth.
- Alarms route to the existing `FAILURE_NOTIFICATION_EMAIL`
  (`seththeeke@gmail.com`) SNS topic — reuse, don't add a new one.
- Every layer logs per `CLAUDE.md` §5.2's pessimistic rule: fan-out logs
  each record's source table + key + `eventName` + forwarded/skipped;
  Slice B's copy step logs per-row-written.

---

## 11. IAM & least privilege

Same explicit-grant convention as every Lambda in this project
(`1-data-ingestion.md`'s precedent — name it, don't inherit a construct
default).

- **Firehose delivery role:** `s3:PutObject` + `s3:GetBucketLocation` +
  `s3:ListBucket` scoped to the warehouse bucket ARN + `/raw/*`, `/errors/*`
  only; `glue:GetTable`/`GetTableVersions`/`GetTableVersion` scoped to the
  one Glue table it converts against (Parquet conversion needs it);
  `logs:PutLogEvents` on its own error log group. Nothing else.
- **Fan-out Lambda (Option A/C):** stream-read (automatic via
  `DynamoEventSource`) + `firehose:PutRecord`/`PutRecordBatch` on the one
  delivery stream. **No table write access, no `dynamodb:*`** — asserted
  absent in a CDK test, same as the other fan-outs.
- **SNS→Firehose (Option A):** the subscription grants Firehose
  `sns:Subscribe`-side automatically; the topic needs no new policy.
- **Athena workgroup / Slice B SFN role:** `athena:StartQueryExecution`/
  `GetQueryExecution`/`GetQueryResults` scoped to the one workgroup;
  `glue:GetTable`/`GetDatabase`/`GetPartitions` on the one database;
  `s3:GetObject` on `raw/*` + `backfill/*`, `s3:PutObject` on
  `athena-results/*`. Result-copy Lambda: `dynamodb:PutItem`/`BatchWriteItem`
  on the one serving table.
- **Backfill export:** `dynamodb:ExportTableToPointInTime` on the source
  table ARNs + `s3:PutObject` on `backfill/*` — a one-time grant, ideally
  to the `nyc311` CLI principal for the manual run, not a standing Lambda
  role.

---

## 12. Cost

At this project's volume (a few 311 polls/day, low hundreds of
Orders/day):

| Component | Cost |
|---|---|
| S3 storage | Cents/month — raw + backfill is well under 1 GB/year Parquet. |
| Kinesis Firehose | Per-GB ingested, ~128 KB minimum record billing rounding. Low single-digit dollars/month at most; likely cents. |
| Athena | $5/TB scanned. A daily job over a year of this data scans megabytes. Effectively free. Workgroup `BytesScannedCutoffPerQuery` set as a guardrail anyway. |
| Glue Data Catalog | First 1M objects stored + 1M requests/month free. Never exceeded here. |
| **Kinesis Data Stream (Option D only)** | **~$30/month on-demand** — the one real recurring cost, and the entire reason Option A is the Slice A recommendation. |

Everything except Option D is "rounding error on the existing AWS bill."

---

## 13. Testing

Same four-tier model (`testing-framework.md`), nothing new invented:

- **Unit (Vitest, 90% per-file):** the fan-out controller + service
  (relevance check — skip `METRIC#`/`CURSOR#`, forward `INSERT`/`MODIFY`;
  `unmarshall`; `firehose:PutRecordBatch` shape; per-item failure
  reporting), any Firehose transformation Lambda, Slice B's result-copy
  controller/service/DAO. The Glue `CfnTable` column lists are data, not
  logic — covered by CDK assertions, not unit tests.
- **CDK assertions:** bucket (RETAIN, block-public, SSE, SSL-only);
  Firehose (per-source, buffering hints, Parquet conversion pointed at
  the right Glue table, error prefix, delivery-role policy scoped — not
  `*`); `CfnDatabase`/`CfnTable` (names env-suffixed, column schema,
  partition-projection properties present and correct — a projection
  typo silently breaks every query, so assert the actual
  `parameters` map like `5-order-evaluation.md` §8 asserts the SNS filter
  policy JSON); Athena workgroup (results location, bytes cutoff);
  fan-out Lambda IAM (firehose-put only, no `dynamodb:*` write).
- **Real integration:** a `test-scripts/` script (matching
  `1-ingestion-test.py`'s style) — write a synthetic Order/OrderEvent to
  `Orders-Test`, wait out the Firehose buffer (~300 s — the script sleeps
  and polls, flag the slowness), run an Athena query via the CLI, assert
  the row appears in `order_events`. **Not a pipeline-blocking gate** —
  same carve-out as `5-order-evaluation.md` §8 / `6-order-scheduling.md`
  §10 (no new API Gateway route in Slice A). Slice B's GET route(s) join
  `4-pipeline-integration-tests.md`'s real gate.

---

## 14. Naming reference

| Piece | Path / name |
|---|---|
| S3 landing bucket | `nyc311-warehouse-<test\|prod>` |
| Glue database | `nyc311_warehouse_<test\|prod>` |
| Glue tables | `order_events`, `order_snapshots`, `requests`, `locations` (+ `*_backfill`) |
| Athena workgroup | `Nyc311Analytics-<Test\|Prod>` |
| Firehose (per source) | `Nyc311Warehouse-OrderEvents-<Test\|Prod>`, `…-Requests-…`, `…-Locations-…` |
| Order-events tap | reuse `Nyc311OrderEventsTopic` (Option A) |
| Requests tap Lambda | `Nyc311WarehouseRequestFanOut-<Test\|Prod>` |
| CDK constructs | `cdk/warehouse/Nyc311Warehouse*.ts` |
| Backend (Slice B) | `backend/{controller/analytics,service/analytics,dao/analytics}/…` |
| SQL assets (Slice B) | `cdk/warehouse/sql/*.sql` — **pending §9 sign-off** |
| Serving table (Slice B) | `AnalyticsRollups-<Test\|Prod>` |
| Integration script | `test-scripts/4-warehouse-test.py` |

---

## Open forks to resolve before building Slice A

1. **§1** — Slice A only, or include one real end-to-end aggregation?
2. **§2** — land the Order projection snapshot, or events-only?
3. **§3** — Option A (reuse SNS + Requests fan-out) vs. Option D (Kinesis
   Data Stream, +$30/mo, future-proof)? This is the biggest one.
4. **§4** — Firehose-native Parquet (with opaque JSON columns) vs. JSON.gz?
5. **§6** — backfill `Requests` (42k mostly-`DRAFT`) too, or Orders +
   Locations only?
6. **§9** — where do `.sql` assets live (`cdk/warehouse/sql/` proposed)?

Everything else has a recommendation above that's a safe default if you
don't want to litigate it.
