# Order Ingestion — Request Promotion, Filtering & Order Creation

> Negotiated starting **2026-08-18**, same progressive/negotiated style as
> `1-data-ingestion.md` / `2-pipeline-monitoring.md`. Resolves the
> project-wide **`[OPEN]`** promotion/filtering item first flagged in
> `claude-prompt-initial.md` §1 and reaffirmed in `1-data-ingestion.md` §1
> ("revisit after initial ingestion is running") — this is that revisit.
>
> **Split out of what was originally going to be part of `5-order-evaluation.md`
> (build-order item 2)**, once it became clear "how does a Request actually
> become an Order" is real, standing infrastructure in its own right — a
> stream listener, a filter/promotion module, and the `Order`-creation
> write — not something to stub for one slice and throw away. This doc owns
> that path: `Request` (draft/pending) → filter evaluation → `Order` in its
> first state. `5-order-evaluation.md` picks up from there and owns what
> happens to a created `Order` next — reworked 2026-08-25 from an original
> Step-Functions-state-machine framing to an event-driven design; see that
> doc for the current shape.
>
> `backend/`/`cdk/` are already unlocked (`CLAUDE.md` §5.1/§5.2) — this doc
> settles design questions before writing code, not a directory unlock.

**Status: Done (closed 2026-08-25).** Both legs deployed and verified
against real `Nyc311-Test` traffic — a `draft` Request now reaches
`evaluateRequest` via the stream→SQS fan-out and produces a real `Order`
in its initial (`INGEST`/`CREATED`) state. Verification surfaced one real
bug (fan-out Lambda crashing at cold start on every invocation, silently,
per the module-scope-DAO incident logged in `CLAUDE.md` §5.2) which was
found and fixed 2026-08-22; `GET /orders` returning real data is now
covered by the pipeline's own integration-test gate (`5-pipeline-
integration-tests.md`, shipped 2026-08-24). Remaining design items below
(§7 alarms/metrics, the atomicity gap, `order_id` denormalization, real
geocoding, real Cases) are accepted gaps, not blockers — logged in
`99-things-to-come-back-to.md` rather than reopening this doc.
`5-order-evaluation.md` is the active doc going forward.

---

## Decision Status

| Topic | Status |
|---|---|
| [1. Top-level pipeline flow & filter-function set](#1-top-level-pipeline-flow--filter-function-set) | **Agreed** |
| [2. Infrastructure around `evaluateRequest`](#2-infrastructure-around-evaluaterequest) (stream listener, controller/service/DAO placement, retry/failure) | **Agreed** — both legs now built (§3) |
| [3. Filter-function contract & module design](#3-filter-function-contract--module-design) | **Agreed, built (2026-08-20)** |
| [4. `duplicate`/`rejected` status semantics](#4-duplicaterejected-status-semantics) | **Agreed — confirmed still dead code today** |
| [5. Order creation on pass](#5-order-creation-on-pass) | **Agreed, built (2026-08-20)** |
| [6. Existing-backlog backfill](#6-existing-backlog-backfill) | **Agreed — gap accepted, logged in `99-things-to-come-back-to.md`** |
| [7. Observability & custom metrics](#7-observability--custom-metrics) | **Deferred** — structured logs shipped; alarms/`MetricFilter`s/UI surfacing accepted as a known gap, logged in `99-things-to-come-back-to.md` |
| [8. Testing](#8-testing) | **Agreed, built alongside §3/§5** |

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

## 3. Filter-function contract & module design

**Agreed and built 2026-08-20.** Lives in
`backend/service/ingestion/requestEvaluationService.ts`.

**Outcome contract:**

```ts
type FilterOutcome =
  | { kind: "CONTINUE"; locationId?: string }
  | { kind: "REJECT"; status: "FILTERED" | "DUPLICATE" | "REJECTED" }
  | { kind: "HALT" };

type FilterFn = (request: Request, deps: FilterDeps) => Promise<FilterOutcome>;
```

`CONTINUE`'s optional `locationId` is the only value any filter needs to
pass forward today (from `resolveLocation` to the final promotion write) —
deliberately not a generic patch bag until a second filter actually needs
one. `evaluateRequest` runs `FILTERS` in order, short-circuiting on the
first non-`CONTINUE`; `HALT` leaves the Request `draft` (no Case yet — see
§1), `REJECT` writes the given terminal status.

**`resolveLocation` is real now** (this session, not just the stub from
§1): reads `raw_payload.bbl` only (no geocoding fallback — still a named
follow-up), calls the new `LocationDao.findOrCreateLocation` (dedup-by-
`bbl`, race-safe), returns `CONTINUE` with the resolved `location_id` or
`HALT` on a miss (after logging a stub Case via `service/case/
caseService.ts` — see §5). `checkAlreadyClosed`/`checkComplaintTypeSupported`/
`checkBusinessDuplicate` stay stubs, per §1.

**Idempotency:** `evaluateRequest` re-fetches the Request's *current*
status from `RequestDao` rather than trusting the SQS message body, and
no-ops if it's no longer `DRAFT`. The order-ingestion queue is standard
(at-least-once, §2.1's agreed design) — a redelivered message must never
double-process an already-evaluated Request (double-create an `Order`,
re-run a filter that isn't idempotent). `RequestDao.updateRequestStatus`
backs this with a real DynamoDB condition (`status = :expectedStatus`),
not just an application-level check — see §5.

---

## 4. `duplicate`/`rejected` status semantics

**Confirmed, not newly decided:** building §3 for real settles this by
showing what's actually reachable today, not by picking new meanings.
`FILTERED`/`DUPLICATE`/`REJECTED` are all still **dead code** — no filter
in the current pipeline produces `REJECT` yet (`resolveLocation` only
`CONTINUE`s or `HALT`s; the other three are pass-through stubs). Their
eventual meanings stay as scoped in §1: `checkAlreadyClosed` → `FILTERED`,
`checkBusinessDuplicate` → `DUPLICATE` (a business-level check, distinct
from `gsi1-external-key`'s already-functioning raw dedup),
`checkComplaintTypeSupported` → presumably `REJECTED`. The `REJECT` branch
in `evaluateRequest` is real, tested code (via dependency-injected fake
filters — `RequestEvaluationDeps.filters`), just not yet exercised by any
production filter.

---

## 5. Order creation on pass

**Agreed and built 2026-08-20.** Building this pulled in real
infrastructure that didn't exist before:

- **`EventSourcedDao<TProjection, TEvent>`** — added to `backend/dao/
  dao.ts` alongside `Dao<TEntity>`, per `CLAUDE.md` §5.2's design (root
  `#METADATA` projection item + `EVENT#<n>` event items, one
  `TransactWriteItems` per `appendEvent` call, condition-checked against
  `last_event_sequence` for optimistic concurrency). First real consumer:
  `OrderDao`.
- **`Order`/`OrderEvent` models** (`backend/models/order.ts`) — the full
  locked `data-model.md#order` event-type vocabulary (all 12
  `ORDER_EVENT_TYPES`), but `OrderStatus` only has one value (`CREATED`)
  today — the rest arrive once `5-order-evaluation.md`'s stages exist to
  need them, not invented speculatively now.
- **`OrdersTable`** (`cdk/data/OrdersTable.ts`) — `ddb-design.md`'s locked
  design (`order_id`+`sk`, `gsi1-stage-sla`, `gsi2-assigned-operator`,
  stream). **Known, deliberate gap:** nothing populates the GSI key
  attributes yet (`gsi1sk`=`sla_deadline`, `gsi2pk`=`assigned_operator_id`)
  — both are always null at creation, since only `5-order-evaluation.md`'s
  Schedule stage will ever set them. Building that derivation now would be
  speculative code for values nothing produces yet.
- **`OrderDao.createOrder`** — writes `ORDER_CREATED`, folds the first-
  state projection (`current_stage: "INGEST"`, `status: "CREATED"`,
  zeroed retry counts, everything workflow-derived null/zero). Does
  **not** trigger any downstream processing itself — `5-order-evaluation.md`
  picks it up independently, off the `Orders` table's own change stream
  (see that doc), not a direct call from this write path.
- **`RequestDao.updateRequestStatus`** — the idempotent promote/reject
  write from §3, condition-checked against `status = "DRAFT"`.

**Known, deliberate simplification — not atomic across tables.**
`evaluateRequest` creates the `Order` first, then writes the Request's
`PROMOTED` status as a second, separate write — not one cross-table
`TransactWriteItems`. If the second write fails after the first succeeds,
the `Order` exists but the `Request` still reads `draft`+un-promoted (or
vice versa if reordered) — a real, recoverable-by-hand inconsistency
window this session accepted rather than generalizing
`EventSourcedDao.appendEvent` to combine transact-items across DAOs.

**Known, pre-existing gap surfaced while building this:** `ddb-design.md`'s
Orders-table section assumed the promotion write would denormalize
`order_id` back onto the `Request` item ("so 'does this Request have an
Order' is a single `GetItem`"), but `data-model.md`'s actual locked
`Request` fields never gained an `order_id` field. Not fixed here — that's
a `data-model.md` change, out of scope for this slice. `Order.request_id`
(already present) is the only link today; finding a Request's Order means
querying Orders, not reading the Request.

**Case creation is a stub, not real yet** — `service/case/caseService.ts`'s
`createCase` only logs and returns (`CreateCaseInputSchema`,
`backend/models/case.ts`, seeds the eventual real `Case` model). No Cases
table, no CaseDao. Establishes the interface `resolveLocation` needs so it
doesn't have to change when Case persistence is actually built.

**New downstream infrastructure**, mirroring §2.1's fan-out Lambda
conventions:
- `backend/controller/ingestion/requestEvaluationController.ts` — SQS-
  triggered, parses each message body as a `Request`, per-item failure
  reporting (`itemIdentifier` = `messageId` for SQS, unlike the fan-out
  leg's `SequenceNumber`).
- `cdk/lambda/Nyc311RequestEvaluationLambda.ts` — consumes
  `Nyc311OrderIngestionQueue`, `batchSize: 10` (smaller than the fan-out
  leg's 100 — each message here does real DB work: a location lookup plus
  an Order-creation transaction, not a single publish).
  `reportBatchItemFailures: true`; retry/DLQ is the queue's own already-
  built redrive policy — no separate `onFailure` destination needed here,
  since (unlike the stream leg) the queue's redrive-to-DLQ already carries
  full message content.

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

## Addendum: Next-Session Checklist (as of 2026-08-20, closed out 2026-08-25)

**Doc closed 2026-08-25** — see Status note at the top. Everything below
this point reflects the state as of 2026-08-20 plus the one update noted
in "Build" (the real-deploy verification that was still outstanding then).
The Design items are accepted, logged gaps now, not open questions blocking
this doc — see `99-things-to-come-back-to.md`.

### Design — accepted gaps (not blockers), logged in `99-things-to-come-back-to.md`

- [ ] **§7 — Observability & custom metrics.** Structured-log fields +
      `MetricFilter`s for this pipeline, mindful of the project-wide
      10-custom-metric cap (`1-data-ingestion.md` §8) — 3 already spent by
      the poller, 7 remain for everything else in the app.
      `evaluateRequest` already logs a structured `FilterEvaluated`/
      `RequestEvaluationCompleted` line per Request (2026-08-20, for later
      aggregation) — no `MetricFilter`s read them yet.
- [ ] **UI surfacing of filter results — deliberately descoped 2026-08-20,
      wants more thought.** A live-count tile (`Select: COUNT` via
      `gsi2-status`) was ruled out: `Requests-Test`'s `DRAFT` bucket is
      already 42,000+ and growing (`99-things-to-come-back-to.md`), so a
      frequently-polled live scan would have real, unbounded RCU cost and
      latency that gets *worse* as the thing it's monitoring gets worse.
      An atomic-counter sentinel item (DynamoDB `UpdateItem` `ADD`,
      O(1) read regardless of backlog size) was proposed as the fix but
      not committed to. For now: no new API endpoint, no DAO counters, no
      web-app tile — `evaluateRequest`'s structured logs are the only
      visibility, to be aggregated by hand/dashboard later. Revisit once
      there's a clearer read on the counter-vs-time-series tradeoff.
- [ ] **CloudWatch alarm specifics** for the fan-out Lambda (§2.3 names
      "sustained `IteratorAge` growth or repeated `Errors`" but no
      concrete metric/threshold/period was picked) — still not built;
      nothing alarms on either Lambda in this pipeline yet.
- [ ] **Atomicity gap in `evaluateRequest`'s promote path** (§5) — Order
      creation and the Request's `PROMOTED` write are two separate calls,
      not one cross-table transaction. Fixing this means generalizing
      `EventSourcedDao.appendEvent` to return its transact-items rather
      than executing them, so a service can combine them with a second
      DAO's write in one `TransactWriteCommand`.
- [ ] **`Request.order_id` denormalization gap** (§5) — `ddb-design.md`
      assumed the promotion write would denormalize `order_id` back onto
      `Request`; `data-model.md`'s locked `Request` fields never gained
      one. `Order.request_id` is the only link today. Needs a
      `data-model.md` decision, not a silent backend fix.
- [ ] **Real `resolveLocation` geocoding fallback** — still BBL-from-
      payload only (§3); records with lat/long but no direct `bbl` still
      `HALT` rather than resolving.
- [ ] **Real Cases infrastructure** — `service/case/caseService.ts`'s
      `createCase` is still a log-only stub (§5). Building it for real
      (Cases table, Case model, CaseDao) is a separate, later slice.

### Build — fan-out leg + request-evaluation leg both complete (2026-08-20)

Both legs of the pipeline are now built, unit-tested, and pass each
package's build/lint/test/coverage gate (backend 239 tests, cdk 78 tests,
both ~100% coverage). **Not yet verified against a real deploy** — no
pipeline run has confirmed either leg in `Nyc311-Test`.

**Fan-out leg** (§2, pushed 2026-08-18/19) — unchanged this session.

**Request-evaluation leg** (§3/§5, built 2026-08-20):
- [x] `backend/models/location.ts`, `backend/dao/location/locationDao.ts`
      (dedup-by-`bbl`, race-safe), `cdk/data/LocationsTable.ts`.
- [x] `backend/models/order.ts`, `backend/dao/order/orderDao.ts`,
      `cdk/data/OrdersTable.ts` — plus the new
      `EventSourcedDao<TProjection, TEvent>` base class in
      `backend/dao/dao.ts` it's the first consumer of.
- [x] `backend/models/case.ts` + `backend/service/case/caseService.ts` —
      the Case-creation stub (log-only, no persistence).
- [x] `backend/models/sqsEvent.ts` — generic SQS Lambda event shape.
- [x] `backend/service/ingestion/requestEvaluationService.ts` — the
      `FilterOutcome`/`FilterFn` contract, `resolveLocation` (real),
      three stub filters, `evaluateRequest`'s idempotent orchestration.
- [x] `backend/dao/request/requestDao.ts`'s new `updateRequestStatus` —
      condition-checked against `status = "DRAFT"`; `backend/dao/dao.ts`'s
      `PutItemOptions` gained `conditionExpressionValues` to support it.
- [x] `backend/controller/ingestion/requestEvaluationController.ts` — SQS-
      triggered, per-item failure reporting.
- [x] `cdk/lambda/Nyc311RequestEvaluationLambda.ts` — `batchSize: 10`,
      `reportBatchItemFailures: true`, consumes
      `Nyc311OrderIngestionQueue`, retry/DLQ via the queue's existing
      redrive policy. Wired into `cdk/stack/Nyc311Stack.ts`.
- [x] IAM: `GetItem`/`PutItem` on all three tables + automatic
      `grantConsumeMessages` — confirmed via a CDK assertion test that no
      broader `dynamodb:*` action appears in this Lambda's policy.
- [x] **Verified against a real `Nyc311-Test` deploy (2026-08-22).** First
      verification pass found the Orders table was silently empty — the
      fan-out Lambda was crashing at cold start on every invocation since
      it shipped, per the module-scope-DAO incident now documented in
      `CLAUDE.md` §5.2. Fixed (lazy DAO construction), re-verified: `Order`
      rows are now created in their initial state from real ingested
      Requests. `GET /orders` returning real data is covered on an ongoing
      basis by the pipeline's integration-test gate (`5-pipeline-
      integration-tests.md`, shipped 2026-08-24), so this doesn't need a
      one-off manual re-check going forward.

`5-order-evaluation.md` can now pick up from a real `Order` in its first
state — no longer blocked on this doc.

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
