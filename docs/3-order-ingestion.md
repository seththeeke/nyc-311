# Order Ingestion — Request Promotion, Filtering & Order Creation

> Negotiated starting **2026-08-18**, same progressive/negotiated style as
> `1-data-ingestion.md` / `2-pipeline-monitoring.md`. Resolves the
> project-wide **`[OPEN]`** promotion/filtering item first flagged in
> `claude-prompt-initial.md` §1 and reaffirmed in `1-data-ingestion.md` §1
> ("revisit after initial ingestion is running") — this is that revisit.
>
> **Split out of what was originally going to be part of `4-order-workflow.md`
> (build-order item 2)**, once it became clear "how does a Request actually
> become an Order" is real, standing infrastructure in its own right — a
> stream listener, a filter/promotion module, and the `Order`-creation
> write — not something to stub for one slice and throw away. This doc owns
> that path: `Request` (draft/pending) → filter evaluation → `Order` in its
> first state. `4-order-workflow.md` picks up from there and owns the state
> machine that actually moves a created `Order` through
> `Ingest → Schedule → Execute → Resolve`.
>
> `backend/`/`cdk/` are already unlocked (`CLAUDE.md` §5.1/§5.2) — this doc
> settles design questions before writing code, not a directory unlock.

---

## Decision Status

| Topic | Status |
|---|---|
| [1. Top-level pipeline flow & filter-function set](#1-top-level-pipeline-flow--filter-function-set) | **Agreed** |
| [2. Infrastructure around `evaluateRequest`](#2-infrastructure-around-evaluaterequest) (stream listener, controller/service/DAO placement, retry/failure) | **Agreed** — fan-out Lambda leg only; downstream processor's infra still `[OPEN]` |
| [3. Filter-function contract & module design](#3-filter-function-contract--module-design) | **[OPEN]** |
| [4. `duplicate`/`rejected` status semantics](#4-duplicaterejected-status-semantics) | **[OPEN]** |
| [5. Order creation on pass](#5-order-creation-on-pass) | **[OPEN]** |
| [6. Existing-backlog backfill](#6-existing-backlog-backfill) | **Agreed — gap accepted, logged in `99-things-to-come-back-to.md`** |
| [7. Observability & custom metrics](#7-observability--custom-metrics) | **[OPEN]** |
| [8. Testing](#8-testing) | **[OPEN]** |

---

## 1. Top-level pipeline flow & filter-function set

**Reframed from the original "location-resolution gate" framing above** —
rather than a standalone `LocationResolver` step gating entry into a
separate "promotion/filter/dedup" pipeline (the two-phase shape
`data-model.md` literally describes: `draft →[resolve]→ pending
→[filter]→ promoted/filtered/duplicate/rejected`), location resolution
becomes **one filter function inside a single, ordered pipeline**. Every
`draft` Request runs the same pipeline; location resolution just happens
to be (usually) the first function in it, since several later ones need
`location_id` set to do their job. This still produces exactly the same
`data-model.md` status outcomes (`draft` stays `draft` on a location miss,
`pending`/`promoted`/`filtered`/`duplicate`/`rejected` otherwise) — it's a
single-module, single-pass reframing of the same state machine, not a
change to the locked model.

### Top-level flow

```
Requests table (draft Request written by poller)
        │  DynamoDB Stream, INSERT
        ▼
 ┌─────────────────────────────────────────────┐
 │           evaluateRequest(request)            │
 │  runs filter functions in fixed order,        │
 │  short-circuits on the first non-"continue"    │
 └─────────────────────────────────────────────┘
        │
        ├─ every filter "continue"  → Request.status = promoted,
        │                              location_id set,
        │                              Order created in first state
        │                              (OrderCreated, current_stage=Ingest)
        │
        ├─ a filter "reject"        → Request.status = filtered |
        │                              duplicate | rejected (§4)
        │                              (no Order)
        │
        └─ resolveLocation "miss"   → Request stays draft,
                                       location_resolution_failure Case
                                       created (payload references
                                       request_id; order_id null)
```

### Candidate filter functions, in pipeline order

| # | Function | Kind | v1 behavior (proposed) |
|---|---|---|---|
| 1 | `resolveLocation` | gate + enrichment | Reads `raw_payload` for a usable `bbl`/lat-long, looks up or creates the `Location` (dedup by `bbl`), sets `location_id`. Miss → halts pipeline entirely (not a "reject" outcome — see below), stays `draft`, spawns a `location_resolution_failure` Case. |
| 2 | `checkAlreadyClosed` | reject filter | NYC 311's own `status` field on the raw record (e.g. `"Closed"`) means the real-world complaint was already resolved before we ever ingested it — nothing for a simulated crew to dispatch to. Reject → `filtered`. |
| 3 | `checkComplaintTypeSupported` | reject filter | Placeholder seam for an eventual admin-configurable per-`complaint_type`/`agency` allow/deny list (ties to `capacity-model.md` §1's agency+borough capacity pools — a complaint type with no matching pool has nowhere to go). |
| 4 | `checkBusinessDuplicate` | reject filter | Distinct from the ingestion-time raw dedup already handled by `gsi1-external-key` (`external_unique_key`, exact-record dedup pre-insert). This is a *business*-level duplicate: is there already an active, unresolved Order for the same `location_id` + `complaint_type`? Reject → `duplicate`. |
| 5 | *(implicit)* | promote | All filters passed → `promoted`, Order created. |

**Given `claude-prompt-initial.md` §1's standing "ingest all complaint
types unfiltered/lightly filtered" directive, not every candidate above
should necessarily *reject* anything in v1** — some may be worth building
as real filters now, others as a pass-through no-op (proves the pipeline
slot exists, rejects nothing yet). Proposed split, open to pushback:

- **`resolveLocation` — real, not a no-op.** This one you've already
  confirmed should be built for real (previous answer), not passthrough-
  only. Concretely: `raw_payload.bbl` direct read where present; a real
  geocoding fallback (lat/long → BBL) is a separate, explicit follow-up,
  not built in this slice — a record with neither a direct `bbl` nor a
  successfully-geocoded one is exactly the miss case above.
- **`checkAlreadyClosed` — real.** Cheap (one field check, no external
  call), and meaningfully reduces noise without touching the "unfiltered
  by complaint type" scope directive at all — it's about record staleness,
  not complaint-type selection.
- **`checkComplaintTypeSupported` — pass-through no-op for v1.** Building
  a real allow/deny list means deciding the actual list, which is exactly
  the kind of business-scope call `claude-prompt-initial.md` §1 explicitly
  deferred. The seam exists so it's a one-function change later, not a
  pipeline redesign.
- **`checkBusinessDuplicate` — pass-through no-op for v1.** Real version
  needs a query shape (an index into "active Orders by location +
  complaint_type") not yet designed anywhere, and duplicate real-world 311
  complaints for the same issue are a real, common pattern (multiple
  neighbors reporting the same noise complaint) — worth its own dedicated
  round rather than deciding the matching rule inline here.

**Agreed (2026-08-18):** the four functions above, kept as **stubs**, all
living inside **one function** for now — not split into four separate
modules/files yet. This proves the pipeline shape (the ordered
short-circuit evaluation, the outcome types, where each responsibility
*will* plug in) without committing to real logic for any of them yet,
including `resolveLocation` — a scope-down from this doc's earlier
real-vs-no-op split. Splitting into real, independent functions (starting
with `resolveLocation`, per the earlier discussion) is explicit follow-up
work, not part of this slice.

**Placeholders — one per responsibility, to be filled in when each is
built for real:**

- **`resolveLocation`** *(stub)* — today: no-op pass-through (does not yet
  read `raw_payload` for a `bbl`; does not yet create/dedup a `Location`).
  Real version: BBL-from-payload, `location_resolution_failure` Case on
  miss (§1's original design above, deferred to follow-up).
- **`checkAlreadyClosed`** *(stub)* — today: no-op pass-through. Real
  version: reject (`filtered`) when the raw 311 record's own `status`
  indicates the real-world complaint is already closed.
- **`checkComplaintTypeSupported`** *(stub)* — today: no-op pass-through.
  Real version: admin-configurable per-`complaint_type`/`agency`
  allow/deny list.
- **`checkBusinessDuplicate`** *(stub)* — today: no-op pass-through. Real
  version: reject (`duplicate`) when an active, unresolved Order already
  exists for the same `location_id` + `complaint_type`.

Net effect for this slice: every `draft` Request that reaches the pipeline
runs all four (stubbed) checks, all pass, and the Request is promoted —
proving the mechanical path (listener → evaluate → promote → create
Order) end-to-end, with the real filtering logic layered in later without
touching that mechanical shape.

---

## 2. Infrastructure around `evaluateRequest`

Covers topics 2 (stream listener), 6 (controller/service/DAO placement),
and 7 (retry/failure handling) together, since they're one coherent design
— what actually invokes the stub function and how failures there are
handled.

### 2.1 Stream listener

**Agreed (2026-08-18): a two-stage fan-out, not one Lambda directly
processing the stream.** A DynamoDB/Kinesis-stream event source mapping's
`onFailure` destination only ever carries stream metadata (shard ID,
sequence-number range) — never the actual record content (§2.3 below) —
so recovering a genuinely failed record means re-reading the stream
within its 24h retention window using that metadata. Rather than live
with that, a small **fan-out Lambda** sits directly on the stream and does
nothing but republish each relevant record onto a **standard SQS queue**;
the actual request-processing Lambda (out of scope for this
listening-only discussion — that's §2.2/§3's territory) consumes from
that queue instead of from the stream directly. SQS's own native
redrive-to-DLQ **does** carry the full message content, so the
content-preserving-DLQ problem moves to a layer that actually solves it,
instead of working around the stream's limitation.

```
Requests table (DynamoDB Stream, NEW_AND_OLD_IMAGES)
        │  event source mapping — batchSize 100, reportBatchItemFailures,
        │  retryAttempts 3, startingPosition LATEST, filtered in-handler
        ▼
  Fan-out Lambda  ← "the listener" this section designs
        │  per relevant record: publish to SQS (message body TBD below)
        ▼
   SQS queue (standard) ──(redrive policy, maxReceiveCount: 3)──▶  SQS DLQ
        │                                                  (full message
        ▼                                                   content, unlike
  Request-processor Lambda                                  the stream's
  (§2.2/§3 — out of scope here)                              onFailure)
```

Everything already agreed above (`NEW_AND_OLD_IMAGES`, per-item failure
isolation via `reportBatchItemFailures`, `retryAttempts: 3`, `batchSize:
100`, `startingPosition: LATEST`, filtering inside the handler rather than
`FilterCriteria`) still applies exactly as decided — to *this* Lambda's
event source mapping, the DynamoDB-Stream-to-fan-out-Lambda leg. The
fan-out Lambda's own job is now about as close to pure plumbing as this
gets: read a stream record, decide relevance (the same in-handler check
already agreed), publish to SQS. No DAO calls, no filter/promotion logic
— that stays entirely in the downstream processor.

**Message body — agreed (2026-08-18): unmarshalled plain JSON, not the
raw DynamoDB AttributeValue format.** The fan-out Lambda converts
`NewImage` via `@aws-sdk/util-dynamodb`'s `unmarshall` before publishing
to SQS — a real (if small) transform, against my own recommendation to
keep this Lambda doing zero interpretation. The downstream processor's
controller still owns the `zod`-parse into the actual `Request` model per
`CLAUDE.md` §5.2 ("parse the raw trigger payload first") — unmarshalling
here just changes *what shape* that raw trigger payload is (plain JSON
inside an SQS message, not a nested DynamoDB Streams record), not who's
responsible for validating it.

**Queue type — agreed: standard, not FIFO.** Requests are independent of
each other; nothing here needs ordering or exactly-once delivery, and the
downstream processor already needs to tolerate redelivery/duplicates
regardless (this project already treats dedup as first-class — the same
reasoning `gsi1-external-key` exists for at the ingestion layer applies
again here).

**Queue redrive policy — agreed: `maxReceiveCount: 3`**, matching the
`retryAttempts: 3` already chosen for the fan-out leg — one consistent
retry budget across both hops of this pipeline rather than a different
number at each.

**DynamoDB Streams on the `Requests` table, not currently enabled** —
`cdk/data/RequestsTable.ts` sets no `dynamoStream` today (confirmed by
reading the construct directly), so turning this on is itself part of
this slice.

**Agreed (2026-08-18): `StreamViewType.NEW_AND_OLD_IMAGES`**, matching the
`Orders` table (`ddb-design.md`) — even though this listener itself only
needs the new image. `dynamoStream` is a table-wide setting shared by
every consumer, and changing it later would mean tearing down and
recreating every existing event source mapping on this stream, not just
adding a new one. Paying for the larger stream record now (negligible at
this project's volume) avoids that disruption if some future consumer
ever needs the old value.

**Filtering happens inside the Lambda handler, not `FilterCriteria` on the
event source mapping** *(agreed 2026-08-18, against my own
recommendation — no `filters` prop is set)*. Every write to this table
invokes the Lambda: the pipeline's own promote-and-write-back `MODIFY`s,
the one-time `CURSOR#NYC_311` sentinel `INSERT`, and every poller-metrics
`METRIC#<ulid>` row (always a fresh `INSERT`, never overwritten, per
`1-data-ingestion.md` §8a). The handler is what decides relevance —
`eventName === "INSERT"` and `NewImage.external_unique_key` present — and
short-circuits (a normal, successful no-op — **not** a `batchItemFailure`)
for anything else, same conditions §2.1 would otherwise have expressed as
`FilterCriteria`. Traded a real cost (every irrelevant write still costs
an invocation and a log line) for keeping all the "is this record worth
processing" logic in one place — code — rather than split between CDK
config and the handler.

Net: the listener still only *acts* on real, newly-ingested Requests, but
it's *invoked* on every write to this table, including the pipeline's own
writes back to it and the other two item shapes sharing it.

**`startingPosition: LATEST`** — the only value consistent with "this
listener only sees Requests written after the stream is enabled" (below);
moot in practice for a freshly-enabled stream (nothing predates it to
`TRIM_HORIZON` from), but it's a required CDK prop and worth stating
explicitly rather than leaving to whatever the default happens to be.

**Batching:** `batchSize: 100` *(agreed 2026-08-18)*, no artificial
`maxBatchingWindow` — Requests arrive in poller-sized bursts up to 2000 at
once every 6h (`PER_RUN_RECORD_CAP`, `1-data-ingestion.md`), not a steady
trickle, so there's no throughput reason to coalesce further with a
window. 100 drains a full 2000-record burst in 20 invocations —
meaningfully fewer than a smaller batch size, while per-item failure
isolation (§2.3, already agreed) is what keeps a larger blast radius per
invocation from becoming a correctness problem: one bad record in a batch
of 100 still only retries that one record, not the other 99.
**`reportBatchItemFailures: true`** (the CDK `DynamoEventSourceProps`
boolean, not a raw string flag) so one malformed record in a batch doesn't
block/retry the other 99 — matches the "each record's outcome, not just a
batch summary" logging convention already established
(`CLAUDE.md` §5.2's `service/` logging rule).

**IAM scoping**, matching `1-data-ingestion.md`'s precedent of naming this
explicitly rather than leaving it to whatever a construct defaults to.
Updated for the two-Lambda design (§2.1) — the fan-out Lambda covered in
this section needs only: stream-read
(`DescribeStream`/`GetRecords`/`GetShardIterator`/`ListStreams` on the
stream ARN — granted automatically by `DynamoEventSource`/
`table.grantStreamRead`, not hand-rolled) and `sqs:SendMessage` on the new
queue (`queue.grantSendMessages`). No `Requests`/`Orders` table write
access at all — that belongs entirely to the downstream request-processor
Lambda, out of scope here. Nothing broader than these two grants, same bar
the poller's Lambda was held to.

**A real, known gap worth naming explicitly: this listener only sees
Requests written *after* the stream is enabled.** DynamoDB Streams don't
retroactively capture history — the ~42,000+ `draft` Requests already
sitting in `Requests-Test` today (confirmed via direct query while
reviewing ingestion) will **not** flow through this pipeline no matter
what starting position is chosen. See the question below.

### 2.2 Controller / service / DAO placement

**Two Lambdas now, per §2.1's fan-out redesign — this subsection covers
only the fan-out Lambda** (the actual "listener" this whole discussion is
scoped to). The downstream request-processor Lambda (§2.1's diagram, which
owns `evaluateRequest` from §1 and the real DAO calls) gets its own
controller/service/DAO placement decided when that piece is actually
designed — out of scope here.

**Revised 2026-08-19, while building this leg.** Originally placed under
a new `order-request-processing` controller directory and a new
`service/orderIngestion/` service module, each holding just this one
file. Moved instead: `fanOutRequestEventsController.ts` into the existing
`controller/ingestion/` (this is a second way a `Request` enters the
system, alongside the SODA poller — not a distinct concern deserving its
own directory), and the fan-out logic folded into the existing poller
service file rather than a new one-function module — which is also why
that file is renamed `nyc311RequestService.ts` (was
`nyc311PollerService.ts`): it now owns *both* how a `Request` gets
created *and* how one gets noticed downstream, so "poller" no longer
described its full scope. `order-request-processing` (the directory) is
deleted; `CLAUDE.md` §5.2's tree updated to match. Current layout:

- **Model:** `backend/models/requestStreamEvent.ts` — the minimal
  DynamoDB Streams Lambda event shape (an array of records, each with a
  `dynamodb.NewImage`/`OldImage` in DynamoDB's own AttributeValue JSON
  format), validated via `zod` as the controller's first move per
  `CLAUDE.md` §5.2.
- **Controller:** `backend/controller/ingestion/
  fanOutRequestEventsController.ts` — parses the stream event via the
  model above, loops the batch, calls the service per record, collects
  per-item failures for `reportBatchItemFailures` (§2.1). Logs full
  request/response per `CLAUDE.md` §5.2's controller logging rule.
- **Service:** `backend/service/ingestion/nyc311RequestService.ts`'s
  `fanOutRequestRecord` — **agreed (2026-08-18): full layering, even
  though there's no DAO to reach.** Owns exactly two things per record:
  the relevance check (`eventName === "INSERT"` and
  `external_unique_key` present, §2.1's in-handler filtering decision) and
  the `unmarshall` + `SendMessage` to the SQS queue. No DAO calls — the
  controller→service→DAO rule exists specifically to keep DAO calls out
  of controllers, and there simply isn't one here — but the service layer
  still exists to keep every backend Lambda structurally consistent rather
  than carving out a "thin enough to skip" exception. Lives alongside
  `pollNyc311`/`recordPollerMetrics`/`listPollerMetrics` in the same file
  now, not a separate module — both are "how a `Request` moves," and
  `nyc311PollerService.ts` was never a *DAO*-scoped module (the DAO
  boundary is `requestDao.ts`), just an ingestion-scoped one.
- **DAO:** none for this Lambda. `requestDao.ts`'s new promote-and-write-
  back method, the new `orderDao.ts`, and the not-yet-built
  `EventSourcedDao<TProjection, TEvent>` base class all belong to the
  downstream request-processor Lambda, not this one.

### 2.3 Retry / failure handling

**Agreed (2026-08-18): per-item failure isolation, not whole-batch
retry.** `reportBatchItemFailures: true` (already needed for §2.1's
batching design) means the handler returns exactly which record IDs
failed; only those get retried, the rest of the batch proceeds. This
supersedes `bisectBatchOnError`, which solves the same
"isolate-the-poison-pill" problem but only for the older
throw-or-succeed model — with per-item reporting already telling AWS
precisely which records failed, batch-bisection has nothing left to do,
so it's **not** set here (unlike a plain throw-based handler, where it
would be the only isolation mechanism available).

Otherwise mirrors the poller's established pattern
(`cdk/lambda/Nyc311PollerSchedule.ts`) rather than inventing a new one:
- **`retryAttempts: 3`** *(agreed 2026-08-18, matches the poller)* per
  failed record before it's sent to an **on-failure Destination**.
- **on-failure Destination: an SQS DLQ** *(agreed 2026-08-18, matching the
  poller's pattern)*, scoped to this fan-out Lambda rather than sharing
  the poller's queue. Worth being explicit about what lands in it, given
  §2.1's earlier finding: because this is a DynamoDB-stream-triggered
  event source mapping, this DLQ receives only stream metadata (shard ID,
  sequence-number range) for the failed batch, **not** the actual record
  content — recovering the real data still means re-reading the stream
  within its 24h retention window using that metadata, or falling back to
  the source-of-truth item already sitting safely in the `Requests` table
  regardless. This is a real, known asymmetry with the *other* DLQ in this
  design (the SQS queue's own redrive-to-DLQ in §2.1, which **does**
  carry full message content) — chosen anyway for consistency with
  established precedent rather than inventing a different shape for just
  this one Lambda.
- **CloudWatch Alarm** on sustained `IteratorAge` growth or repeated
  `Errors` — the stream-processing equivalent of the poller's "3
  consecutive failed runs" alarm, since a stuck/erroring listener here
  means Requests silently stop becoming Orders with no other visible
  signal.

---

## 6. Existing-backlog backfill

Per §2.1: the ~42,000+ `draft` Requests already in `Requests-Test` (and
whatever's sat in `Requests-Prod`, currently paused —
`1-data-ingestion.md`'s Outstanding Items) will never reach this pipeline
via the stream, no matter its starting position. Two real options:

- **Accept the gap for now, named explicitly** — matches this project's
  established pattern of naming a known limitation rather than silently
  leaving it (e.g. `1-data-ingestion.md`'s own "Still Open"/"Outstanding
  Items" sections). New Requests flow correctly from the moment this ships
  forward; the pre-existing backlog stays stuck in `draft` until a
  deliberate follow-up backfill.
- **Build a one-time backfill now** — a script or on-demand Lambda that
  `Query`s `gsi2-status` (`gsi2pk = "DRAFT"`) and feeds each item through
  the same `evaluateRequest` path the stream listener calls, reusing the
  service layer rather than duplicating logic. Real, if small, extra
  scope in this slice; but it's genuinely the only way historical data
  ever gets promoted, versus a purely go-forward system that only starts
  meaning something once fresh data arrives.

**Agreed (2026-08-18): accept the gap.** Logged in
`99-things-to-come-back-to.md` rather than repeated here — the backlog
stays stuck in `draft` until a deliberate later backfill, revisited once
the filters (§1) are real rather than stubs, so that backfill run doubles
as a real test of them against actual data.

---

*(Remaining topics — §3 filter-function contract, §4 `duplicate`/
`rejected` semantics, §5 Order creation on pass, §7 observability, §8
testing — not yet elaborated.)*

---

## Addendum: Next-Session Checklist (as of 2026-08-18)

Nothing in this doc has been built yet — everything below is either
design still to negotiate, or code not yet written for what's already
agreed. `4-order-workflow.md` picks up once §5 (Order creation) settles
what it hands off.

### Design — still `[OPEN]`

- [ ] **§3 — Filter-function contract & module design.** The actual TS
      shape of a filter function's return value (continue/reject/case
      outcome types) and how `evaluateRequest` composes the four stubs
      from §1 into one function.
- [ ] **§4 — `duplicate`/`rejected` status semantics.** Confirm what these
      `Request.status` values mean now that ingestion-time dedup already
      happens via `gsi1-external-key` — is `duplicate` purely the
      business-level check from §1's `checkBusinessDuplicate`, and is
      `rejected` actually reachable by anything in the current filter
      list, or dead until a real filter needs it?
- [ ] **§5 — Order creation on pass.** What "first state" means
      concretely on the `Order` projection/`OrderCreated` event, and the
      still-open boundary question with `4-order-workflow.md`: does
      creating the `Order` here also `StartExecution` on the state
      machine, or is that a separate trigger?
- [ ] **§7 — Observability & custom metrics.** Structured-log fields +
      `MetricFilter`s for this pipeline, mindful of the project-wide
      10-custom-metric cap (`1-data-ingestion.md` §8) — 3 already spent by
      the poller, 7 remain for everything else in the app.
- [ ] **§8 — Testing.** Fixture strategy for stream/SQS events, matching
      `1-data-ingestion.md` §7's hand-written-fixtures-over-real-samples
      precedent.
- [ ] **Downstream processor's own infra** (§2.2 explicitly scoped it
      out) — controller/service/DAO placement, IAM, retry/DLQ for the
      SQS-triggered request-processor Lambda, mirroring the question-by-
      question pass §2 just got for the fan-out leg.
- [ ] **CloudWatch alarm specifics** for the fan-out Lambda (§2.3 names
      "sustained `IteratorAge` growth or repeated `Errors`" but no
      concrete metric/threshold/period was picked) — **deliberately not
      built 2026-08-18** for exactly this reason; nothing alarms on this
      Lambda yet.
- [x] ~~**Lambda runtime settings** (memory, timeout, reserved concurrency
      if any) for the fan-out Lambda — not discussed.~~ **Set 2026-08-18
      as reasonable defaults, not deeply negotiated**: `memorySize: 256`,
      `timeout: 30s`, no reserved concurrency — matches the light
      unmarshall-and-publish workload. Revisit if real traffic says
      otherwise.
- [x] ~~**Exact CDK construct naming/file layout**~~ — settled while
      building (below).

### Build — fan-out leg complete (2026-08-18, reorganized 2026-08-19)

The fan-out leg (§2, already fully agreed) is built, unit-tested, and
passes each package's build/lint/test/coverage gate. Pushed to `main`
2026-08-18; reorganized (controller/service placement, §2.2) and pushed
again 2026-08-19. Still **not verified against a real deploy** — no
pipeline run has confirmed this in `Nyc311-Test` yet.

- [x] Enabled `dynamoStream: StreamViewType.NEW_AND_OLD_IMAGES` on
      `cdk/data/RequestsTable.ts`.
- [x] `cdk/lambda/Nyc311OrderIngestionQueue.ts` — standard SQS queue + DLQ,
      `maxReceiveCount: 3` redrive policy.
- [x] `cdk/lambda/Nyc311OrderFanOutLambda.ts`'s own SQS DLQ for the event
      source mapping's `onFailure` (metadata-only, per §2.3).
- [x] `backend/models/requestStreamEvent.ts` — DynamoDB Streams Lambda
      event shape, `zod`-validated.
- [x] `backend/controller/ingestion/fanOutRequestEventsController.ts`
      (moved from `order-request-processing/`, 2026-08-19 — that directory
      no longer exists).
- [x] `backend/service/ingestion/nyc311RequestService.ts`'s
      `fanOutRequestRecord` — relevance check + `unmarshall` +
      `SendMessage` (folded in 2026-08-19; `service/orderIngestion/
      requestFanOutService.ts` no longer exists, and the file itself is
      renamed from `nyc311PollerService.ts` — §2.2).
- [x] `cdk/lambda/Nyc311OrderFanOutLambda.ts` — custom construct extending
      `NodejsFunction`, per `CLAUDE.md` §5.3 — event source mapping:
      `batchSize: 100`, `startingPosition: LATEST`,
      `reportBatchItemFailures: true`, `retryAttempts: 3`, `onFailure` →
      its DLQ, filtering done in-handler (no `filters` prop). Wired into
      `cdk/stack/Nyc311Stack.ts`.
- [x] IAM: `table.grantStreamRead` (automatic, via `DynamoEventSource`) +
      `queue.grantSendMessages` only — confirmed via a CDK assertion test
      that no `dynamodb:Put*`/`Update*`/`Delete*` action appears anywhere
      in this Lambda's policy.
- [x] Unit tests (fan-out service/controller, 100% coverage) + CDK
      assertion tests for both new constructs (100% coverage) — both
      packages' `test:coverage` gate passes.
- [ ] **Not done yet:** verify via the pipeline against a real
      `Nyc311-Test` deploy.

Everything downstream of the SQS queue (the request-processor Lambda:
`evaluateRequest`, `orderDao.ts`, the new `EventSourcedDao<TProjection,
TEvent>` base class, the promote-and-write-back on `requestDao.ts`) has no
build checklist yet — its design (§3/§4/§5) isn't settled.

---

## Addendum: Comment verbosity (flagged 2026-08-19, first pass done 2026-08-19)

**Update:** the volume half is now addressed, project-wide, not just this
slice — `CLAUDE.md` §6.1 locks in block-comment-only + a 500-character
prose cap, enforced by a custom ESLint rule (`local/comment-format`) in
every package, and every existing comment over the cap was manually
shortened. What's still genuinely open, unchanged from the original flag:

- Is 500 characters the right steady-state cap, or should it shrink
  further once a decision is old enough to be "just how the code works"
  rather than a live rationale worth restating in-line?
- Does density need to *decay over time* on top of the flat cap — e.g. a
  trigger (age, a doc reaching "Agreed" status) that prompts trimming an
  already-compliant comment further, and whose job that is (whoever
  touches the file next, or a dedicated pass)?
- Does one cap fit every layer, or do `backend/`/`cdk/`/tests warrant
  different bars (e.g. a CDK construct's IAM-scoping rationale staying
  fuller vs. test-file commentary trimming sooner)?

Worth a deliberate pass once there's more code to judge the pattern
against, not a rule invented from this one slice alone.
