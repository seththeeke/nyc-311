# Order Evaluation — Post-Creation Accept/Reject/Case Decision

> **Reworked 2026-08-25** from the original `4-order-workflow.md` (renamed
> from this file's old name, `5-pipeline-integration-tests.md` renamed to
> `4-pipeline-integration-tests.md` to keep numbering sequential). That
> doc framed build-order item 2 (`claude-prompt-initial.md` §10) as a
> single Step Functions state machine driving a created `Order` through
> all four `capacity-model.md` §8 stages (`Ingest → Schedule → Execute →
> Resolve`), one continuous execution per Order.
>
> **Superseded after a design discussion 2026-08-25.** Step Functions as
> the *central* orchestration mechanism was dropped — not banned outright,
> but no longer the default shape for this slice. Two reasons, both
> real, not just preference:
>
> 1. **A single per-Order execution can't cleanly express the `Schedule`
>    stage's actual shape** — an Order waiting for capacity needs a
>    cross-Order dispatch decision (priority + aging, per `capacity-model.md`
>    §5, evaluated against the *whole* waiting queue), not something one
>    Order's own execution can compute about itself. (`ddb-design.md`'s
>    `gsi1-stage-sla` was already built for this — its stated purpose is a
>    "capacity engine's dispatch loop," i.e. a separate process, not
>    self-service by each Order.) A task-token callback pattern can bridge
>    this, but adds real mechanism weight.
> 2. **A live Step Functions execution is state that exists outside the
>    `OrderEvent` stream** — `data-model.md` §3.4's invariant ("the
>    projection must always be re-derivable by replaying `OrderEvent`s from
>    sequence 0 — it's a cache, not a second source of truth") only holds
>    for business/read state; a paused execution's own control-flow
>    position is a second, independently-persisted thing nothing can
>    reconstruct from the event log. Workable with discipline (idempotent
>    event-appends at stage boundaries, `execution_arn` stored for
>    correlation), but it's real, ongoing coupling between two systems for
>    what should be Order lifecycle changes that can flex — stages added,
>    removed, or revisited out of strict sequence — without redesigning an
>    ASL state machine each time.
>
> **Chosen instead: choreographed, event-driven.** The `OrderEvent` stream
> is the only durable state. Reactions to it are plain Lambda-on-a-queue
> consumers, not a long-lived orchestrator — closer to the fan-out pattern
> `3-order-ingestion.md` §2.1 already built for `Request`, one layer added
> (SNS between the stream and the queue — see §3). Step Functions isn't
> ruled out forever; it's just not the default framing for how an `Order`
> moves, and nothing here blocks reaching for it later for a genuinely
> sequential, single-execution concern if one shows up.
>
> **Scope of this doc: only the decision immediately after `OrderCreated`.**
> `3-order-ingestion.md` already builds and ships a created `Order` in its
> first state (`current_stage: "INGEST"`, `status: "CREATED"`). This doc
> owns evaluating that Order — accept, reject, or hand off to a Case for
> something the system can't manage — as three `OrderEvent`-recorded
> outcomes. `Schedule`/`Execute`/`Resolve` (capacity-aware dispatch,
> execution, resolution) are explicitly **not** addressed here — separate,
> later docs, once there's a real capacity model to build against
> (`Operators`/`Shifts` tables don't exist yet either).
>
> `backend/`/`cdk/` are already unlocked (`CLAUDE.md` §5.1/§5.2) — this doc
> settles design questions before writing code, not a directory unlock.

---

## Decision Status

Negotiated **question by question**, same progressive style as every
other doc in this set. Nothing below is decided yet — this table is the
proposed shape of the conversation, open to reordering/splitting/merging.

| Topic | Status |
|---|---|
| [1. Outcome semantics — accept/reject/case](#1-outcome-semantics--acceptrejectcase) | **Agreed (2026-08-25)** |
| [2. Evaluation rule interface & mock implementation](#2-evaluation-rule-interface--mock-implementation) | **Agreed (2026-08-25)** |
| [3. Fan-out infrastructure](#3-fan-out-infrastructure) | **Agreed (2026-08-25)** |
| [4. `OrderEvent`/status model changes](#4-orderevent-status-model-changes) | **Agreed (2026-08-25)** |
| [5. Case-creation mapping](#5-case-creation-mapping) | **Deferred (2026-08-25)** — stays on the existing log-only stub |
| [6. Idempotency & retry/failure handling](#6-idempotency--retryfailure-handling) | **Agreed (2026-08-25)** |
| [7. Observability & metrics](#7-observability--metrics) | **Agreed (2026-08-25)** |
| [8. Testing](#8-testing) | **Agreed (2026-08-25)** |

---

## 1. Outcome semantics — accept/reject/case

**Agreed (2026-08-25):** the evaluation rule (§2) produces exactly one of
three outcomes for every `Order` it evaluates — a real three-way rule
contract, not two outcomes plus a separate error-path fallback:

- **`ACCEPT`** — Order proceeds. For this slice, "proceeds" just means it
  exits evaluation in a non-terminal state — there's nothing downstream to
  hand off to yet (§`Schedule` is out of scope, see intro).
- **`REJECT`** — **Terminal, no further processing.** The Order's story
  ends here — same shape as `Request`'s `FILTERED`/`DUPLICATE`/`REJECTED`
  statuses in `3-order-ingestion.md`: a dead-end status, not something that
  spawns a Case or needs any further downstream handling. Stays queryable
  for audit/analytics via its own `OrderEvent` history.
- **`CASE`** — the rule determined it genuinely doesn't have a basis to
  decide ("unmanageable" — no rule applies), distinct from "a rule fired
  and said no" (`REJECT`). Spawns a Case, mapping per §5.

A genuine evaluation **error** (the rule implementation throws, malformed
`Order` data) is a different thing entirely — an infrastructure failure,
handled by ordinary retry/DLQ mechanics (§6), not one of the three rule
outcomes above.

---

## 2. Evaluation rule interface & mock implementation

Pluggable interface, same pattern as `LocationResolver` /
`TransitTimeEstimator` / `ProcessingTimeEstimator` elsewhere in this
project — a real future implementation swaps in without changing callers.

```ts
// backend/service/order/orderEvaluationService.ts
export type OrderEvaluationOutcome = "ACCEPT" | "REJECT" | "CASE";

export interface OrderEvaluationRule {
  evaluate(order: Order): Promise<OrderEvaluationOutcome>;
}
```

**v1 (mock) implementation — agreed 2026-08-25:** a single random-number
draw, fixed split, no inspection of the `Order` at all (doesn't look at
`complaint_type`, `location_id`, anything) — proves the three-outcome
contract and the event-recording/Case-handoff plumbing without deciding
any real business rule, same "stub proves the shape, real logic later"
pattern `3-order-ingestion.md` §1 used for its four filter functions:

| Outcome | Share |
|---|---|
| `ACCEPT` | 80% |
| `REJECT` | 19% |
| `CASE` | 1% |

Lives alongside the orchestration function that calls it
(`evaluateOrder`, name TBD — mirrors `requestEvaluationService.ts`'s
`evaluateRequest` shape from `3-order-ingestion.md` §3) in
`backend/service/order/orderEvaluationService.ts`, not a separate module —
same reasoning as that precedent: one small, cohesive file for "how an
Order gets evaluated," not a module per stub.

---

## 3. Fan-out infrastructure

**Agreed (2026-08-25):** a two-stage fan-out off the `Orders` table's own
DynamoDB Stream, mirroring `3-order-ingestion.md` §2.1's shape with one
layer added (SNS between the stream and the queue).

```
Orders table (DynamoDB Stream, NEW_AND_OLD_IMAGES — already enabled)
        │  event source mapping — batchSize 100, reportBatchItemFailures,
        │  retryAttempts 3, startingPosition LATEST
        ▼
  Order-change fan-out Lambda   ← forwards every appended OrderEvent,
        │                          nothing else (in-handler filter:
        │                          eventName === "INSERT" && sk starts
        │                          with "EVENT#" — never #METADATA)
        │  publish, message attribute event_type = OrderEvent.event_type
        ▼
   SNS topic (Nyc311OrderEventsTopic)
        │  filtered subscription: {event_type: ["ORDER_CREATED"]}
        ▼
   SQS queue (Nyc311OrderEvaluationQueue, standard) ──(redrive, maxReceiveCount 3)──▶ DLQ
        │
        ▼
  Order-evaluation Lambda (§2's evaluateOrder, real DAO/Case work)
```

**Why every `OrderEvent`, not just creation.** Decided over the narrower
"only forward newly-created Orders" alternative (which would've mirrored
`3-order-ingestion.md`'s Request fan-out exactly). Forwarding the full,
self-describing event stream means the loop-prevention (the evaluator
never re-triggers on its own `ACCEPT`/`REJECT`/`CASE` outcome event,
whatever `event_type` §4 gives that) is a **declarative SNS filter
policy**, not in-handler code — visible in CDK, not something a future
handler edit could silently break. It also means a future consumer
(capacity dispatcher, audit trail, admin live-updates) subscribes with its
own filter policy against the same topic, no fan-out Lambda change
required — the actual reason SNS earns a layer here that the simpler
Request fan-out didn't need.

**Naming collision, flagged explicitly:** `cdk/lambda/Nyc311OrderFanOutLambda.ts`
**already exists** — but it's the *Requests*-table fan-out from
`3-order-ingestion.md` §2.1 (named for what it feeds — the order-ingestion
queue — not what it listens to). This doc's new construct needs a
genuinely distinct name to avoid confusion: **`Nyc311OrderEventFanOutLambda`**
(listens to `OrdersTable`'s stream, publishes to SNS).

**Message body — same "unmarshalled plain JSON" decision as
`3-order-ingestion.md` §2.1:** the fan-out Lambda converts the stream
record's `NewImage` via `@aws-sdk/util-dynamodb`'s `unmarshall` before
publishing. The evaluator's controller still owns the `zod`-parse into the
real `OrderEvent` model (`CLAUDE.md` §5.2) — unmarshalling only changes
*what shape* the raw trigger payload is (an SNS-wrapped SQS message body,
not a nested DynamoDB Streams record).

**Queue/retry mechanics — same numbers as `3-order-ingestion.md` §2.1/§2.3,
no reason to invent new ones:** standard SQS (not FIFO — Orders are
independent, evaluation must already tolerate redelivery), `batchSize: 10`
on the evaluator (matches `Nyc311RequestEvaluationLambda` — real DB work
per message, not a single publish), `reportBatchItemFailures: true`,
`retryAttempts: 3` on the fan-out leg's event source mapping matching the
queue's own `maxReceiveCount: 3` redrive policy, fan-out's own on-failure
destination an SQS DLQ (stream metadata only, same known asymmetry vs. the
queue's own content-preserving redrive-to-DLQ, accepted for the same
consistency-with-precedent reasoning).

**Controller/service/DAO placement — two Lambdas, mirroring
`3-order-ingestion.md` §2.2's split:**
- **Fan-out leg** (`Nyc311OrderEventFanOutLambda`): controller
  `backend/controller/order-processing/fanOutOrderEventsController.ts`;
  service function `fanOutOrderEvent` — pure plumbing (relevance check +
  unmarshall + `sns:Publish` with the `event_type` message attribute), no
  DAO calls, same "full layering even with nothing to reach" reasoning as
  the Request fan-out's service function.
- **Evaluation leg** (real DAO/Case work): controller
  `backend/controller/order-processing/evaluateOrderController.ts`;
  service `orderEvaluationService.ts` (§2) — `evaluateOrder` plus the
  `OrderEvaluationRule` interface and its mock implementation.
- Both land in `controller/order-processing/`, the directory `CLAUDE.md`
  §5.2 already names for "the main order... workflow" — that description
  currently says **"step function workflow,"** stale now that Step
  Functions isn't the mechanism. Needs a `CLAUDE.md` wording fix alongside
  this build (drop "step function," keep the directory), not a structural
  change.

**IAM scoping**, same explicit-grants convention as every other Lambda in
this project: the fan-out Lambda gets stream-read (via `DynamoEventSource`/
`table.grantStreamRead`, automatic) and `sns:Publish` on the new topic only
— no `Orders` table read/write access, same "pure plumbing, no DAO" shape
as its Request-side counterpart. The evaluation Lambda gets
`sqs:ReceiveMessage`/`DeleteMessage` (automatic via
`grantConsumeMessages`) plus whatever `Orders`/`Cases` DAO access §5/§6
end up needing.

---

## 4. `OrderEvent`/status model changes

**Agreed (2026-08-25).**

### `current_stage`

No schema change — `ORDER_STAGES` already has `SCHEDULE`.

- `ACCEPT` → `current_stage: "SCHEDULE"`. This is the actual hand-off
  mechanism to the (not-yet-built) capacity dispatcher: `gsi1-stage-sla`
  was already designed for exactly this ("`Query gsi1pk = "STAGE#Schedule"`
  ... capacity engine's dispatch loop," `ddb-design.md`) — moving
  `current_stage` here is what makes an accepted Order show up in that
  queue, once a later doc builds something that queries it.
- `REJECT` → `current_stage` stays `"INGEST"` — it never advanced.
- `CASE` → `current_stage` stays `"INGEST"` too.

### `status`

New values added to `ORDER_STATUSES` (today just `CREATED`):

- `CREATED` — unchanged, pre-evaluation.
- `ACTIVE` — passed evaluation, moving forward. Deliberately not
  `PENDING_SCHEDULE` or anything stage-specific — `current_stage` already
  carries the fine-grained "where," so this one value covers every future
  stage an Order moves through without minting a new status per stage.
- `REJECTED` — terminal.

**Revised from the original proposal: no `CASE_PENDING` status.** Flagged
correctly — a Case being open isn't a deterministic point in the Order's
own lifecycle (an Order could just as easily have an open Case *while*
`ACTIVE`, e.g. a future `workflow_execution_failure` Case raised mid-
`Execute`, not just at evaluation time). Whether a Case is open is a
**separate, orthogonal signal**, already modeled as its own field
(`Order.case_id`, nullable FK) — not something `status` should encode or
be forced through. So the `CASE` outcome does **not** change `status` or
`current_stage` at all: it fires `CASE_CREATED` (already an existing
event type, previously unused — same as `3-order-ingestion.md` §4 found
for `Request`'s dead-code statuses) and sets `case_id`, leaving `status`
at whatever it already was (`CREATED`, since evaluation hasn't produced a
determinate `ACCEPT`/`REJECT` yet). This also means **idempotency for the
evaluator (§6) can't key off `status === "CREATED"` alone** — it has to
also check `case_id === null`, since a `CASE` outcome leaves `status`
unchanged. Flagging here, nailed down properly in §6.

When a Case eventually gets resolved (a later doc's concern — Case
Workflow / admin action, not built here), the resolution action emits the
same `ORDER_ACCEPTED`/`ORDER_REJECTED` events below, just with a
different `actor` (`agent`/`admin` instead of `system`) — the vocabulary
is designed to be reusable there without changes, even though building
that resolution flow is out of scope for this doc.

### New `OrderEvent` types

`ORDER_ACCEPTED`, `ORDER_REJECTED` added to `ORDER_EVENT_TYPES`.
Deliberately not reusing `STAGE_SUCCEEDED`/`STAGE_FAILED` — those stay
reserved for genuine execution retry/failure semantics (§6, once real
stage work exists beyond evaluation itself); accept/reject is a business-
rule decision, not an execution outcome, and overloading `STAGE_FAILED`
for both would blur what it means once retries are actually designed.

### `PriorityAssigned` — stubbed now, real later

**Agreed (2026-08-25):** `ACCEPT` also fires the existing (previously
unused) `PriorityAssigned` event, stamping `priority_tier`/`sla_deadline`
— without this, an Order moved to `current_stage: "SCHEDULE"` wouldn't
appear in `gsi1-stage-sla` at all (DynamoDB GSIs require the sort-key
attribute to be *present*, not just non-empty — `3-order-ingestion.md` §5
already flagged this as a gap deferred to whichever doc first moves an
Order into `SCHEDULE`; that's this one). Real priority/SLA business logic
(`capacity-model.md` §5/§6 — per-`complaint_type` tiers, admin-configurable
thresholds) doesn't exist yet, so this is stubbed behind its own pluggable
interface, same pattern as everything else in this doc:

```ts
// backend/service/order/orderPriorityService.ts
export interface OrderPriorityAssigner {
  assign(order: Order): Promise<{ priorityTier: string; slaDeadline: string }>;
}
```

**v1 (mock) implementation:** fixed `priority_tier: "STANDARD"` and
`sla_deadline = now + 24h` for every Order, no inspection of
`complaint_type` or anything else — same "stub proves the shape" pattern
as the evaluation rule (§2). `priority_tier` is already a plain
`z.string()` on the `Order` schema (not a locked enum), so no model
change needed there beyond the two new statuses/event types above.

---

## 5. Case-creation mapping

**Deferred (2026-08-25).** The `CASE` outcome calls the existing
`service/case/caseService.ts` `createCase` stub as-is — same log-only,
no-persistence shape `3-order-ingestion.md` §5 already established for
`resolveLocation`'s `location_resolution_failure` path. Not deciding a
real `case_type` for it right now: today's `CASE_TYPES` enum
(`WORKFLOW_EXECUTION_FAILURE` / `LOCATION_RESOLUTION_FAILURE` /
`CAPACITY_SLA_BREACH`) has nothing that actually fits "evaluation had no
applicable rule," so the call uses `WORKFLOW_EXECUTION_FAILURE` as a
placeholder (closest existing fit, not a real semantic claim) until the
real Case data model — and this doc's own `case_type` — get decided
together, later.

---

## 6. Idempotency & retry/failure handling

**Agreed (2026-08-25)**, mirroring `3-order-ingestion.md` §3's
already-proven shape for `evaluateRequest` — reused directly, not
reinvented, since it's the exact same problem (a standard, at-least-once
SQS queue must never let a redelivered message double-evaluate).

**App-level pre-check, before drawing any outcome:** `evaluateOrder`
re-fetches the Order's current projection first. Per §4's finding, the
check can't be `status === "CREATED"` alone (a `CASE` outcome leaves
`status` unchanged) — it's `status === "CREATED" && case_id === null`.
Fails either half → no-op, log, return. This runs *before* the mock rule
(§2) draws a random outcome, not after — a duplicate delivery should
never even roll the dice, both to avoid a wasted/nondeterministic draw and
to keep the logs honest about what actually happened.

**DAO-level backstop, no new code needed:** `EventSourcedDao.appendEvent`
already condition-checks `last_event_sequence` inside its
`TransactWriteItems` call and throws `TerminalError` on a lost race —
built for exactly this. If two invocations somehow both pass the app-level
check concurrently, only one write succeeds; the loser's thrown
`TerminalError` becomes a `reportBatchItemFailures` failure, SQS
redelivers, and the redelivery's app-level pre-check now sees the
already-evaluated Order and cleanly no-ops. Same self-healing shape as
`RequestDao.updateRequestStatus`'s condition-check — no special-case
handling required in `evaluateOrder` itself.

**No new `TransientError` class.** Flagged as a likely gap earlier in this
conversation, back when the design still routed through Step Functions
`Retry`/`Catch` blocks that needed to branch on error type. That
reasoning no longer applies: a plain SQS queue retries *every* thrown
error uniformly (up to `maxReceiveCount`) regardless of type — there's no
code path left that needs to distinguish "transient, retry" from
"terminal, stop" the way an ASL `Catch` block did. `ValidationError`/
`TerminalError` (already defined) remain sufficient.

**Queue/redrive numbers** — restated from §3, not new: `maxReceiveCount: 3`
on `Nyc311OrderEvaluationQueue`, `batchSize: 10`, `reportBatchItemFailures: true`.

**Agreed (2026-08-25): accept the DLQ gap for now.** A message that
genuinely, permanently fails (not a benign idempotency race — a real bug,
malformed data, a sustained DynamoDB outage) and exhausts
`maxReceiveCount` lands in `Nyc311OrderEvaluationQueue`'s DLQ with nothing
reacting to it — no automatic Case creation. This is a real behavior gap
against the original brief (`claude-prompt-initial.md` §4.1 wanted
exhausted retries to transition to Case creation automatically; the old
Step-Functions design got that for free via `Catch`). Named explicitly
rather than silently dropped, same pattern as this project's other
accepted gaps (e.g. `3-order-ingestion.md` §6's backfill gap) — logged in
`99-things-to-come-back-to.md`, plus a CloudWatch alarm on the DLQ's
`ApproximateNumberOfMessagesVisible` for ops visibility in the meantime. A
DLQ-consumer Lambda that creates a Case for a permanently-failed
evaluation is the natural fix, revisit once real Case persistence (§5)
exists rather than building it against the mock stub.

---

## 7. Observability & metrics

**Agreed (2026-08-25): structured logs only, no new `MetricFilter`s** —
same restraint `3-order-ingestion.md` §7 already chose for its own filter
pipeline, for the same reasons:

- **Logging**, per `CLAUDE.md` §5.2's pessimistic-logging rule, at every
  layer: the fan-out controller logs the full stream record in/out; the
  evaluation controller logs the full SQS message in/out; the evaluation
  service logs one structured line per Order (`OrderEvaluationStarted`,
  then `OrderEvaluationCompleted` carrying the outcome — `ACCEPT`/
  `REJECT`/`CASE` — and, for `CASE`, the Case-creation call) — same shape
  as `requestEvaluationService.ts`'s existing `FilterEvaluated`/
  `RequestEvaluationCompleted` lines.
- **No `MetricFilter`s yet**, despite budget existing (3 of the
  project-wide 10-custom-metric cap spent so far — `1-data-ingestion.md`
  §8 — all by the poller; 7 remain). Not a budget constraint, a repeat of
  `3-order-ingestion.md`'s own reasoning: a live-count/rate tile would need
  either a scan (real RCU cost, gets worse exactly when the thing it's
  monitoring gets worse) or an atomic-counter sentinel item not yet
  designed anywhere. Structured logs stay the only visibility for now,
  aggregated by hand/dashboard later — revisit alongside that same
  counter-vs-time-series tradeoff `3-order-ingestion.md`'s Addendum left
  open, not a new decision to relitigate here.
- **CloudWatch Alarms**, matching the fan-out/evaluation Lambda pattern
  already established for the Requests-side pipeline: sustained
  `IteratorAge` growth or repeated `Errors` on the fan-out leg's event
  source mapping, plus the DLQ depth alarm from §6.

---

## 8. Testing

**Agreed (2026-08-25).** Same four-tier model as every other package
(`testing-framework.md`), nothing new invented for this doc:

- **Unit (Vitest, 90% per-file):** `OrderEvaluationRule` (the interface +
  mock implementation), `OrderPriorityAssigner` (interface + mock),
  `evaluateOrder`'s idempotency branches (already-evaluated no-op, race-
  lost `TerminalError` handled by the caller, each of the three outcomes),
  both controllers (fan-out and evaluation), the fan-out service's
  relevance/unmarshall/publish logic.
- **CDK assertions:** the new `Nyc311OrderEventFanOutLambda`, the SNS
  topic, and — worth calling out specifically, since this is the first
  filtered SNS subscription in the project — a fine-grained assertion on
  the **actual filter policy JSON** (`{event_type: ["ORDER_CREATED"]}`),
  not just that a subscription exists. `testing-framework.md` §3's
  "fine-grained assertions document *why* an invariant exists" guidance
  applies directly here: a filter-policy typo would silently break the
  entire evaluation pipeline (nothing would ever reach the queue) without
  failing any resource-existence check.
- **No new real-integration route.** This doc adds no API Gateway route,
  so it doesn't participate in `4-pipeline-integration-tests.md`'s
  endpoint-coverage gate directly. Same carve-out that doc already made for
  `1-ingestion-test.py` — worth a `test-scripts/`-style script that
  invokes the fan-out path (or writes a test Order directly) and polls
  DynamoDB for the resulting `ORDER_ACCEPTED`/`ORDER_REJECTED`/
  `CASE_CREATED` event, for manual/on-demand sanity-checking against a
  real `Nyc311-Test` deploy — not a pipeline-blocking gate, same spirit as
  that precedent.

---

## Build Checklist

Split into two legs, same shape as `3-order-ingestion.md`'s own two-session
build (fan-out leg, then evaluation leg) — not one slice.

### Leg 1 — fan-out (`Orders` stream → SNS)

- [ ] `backend/models/order.ts` — add `ORDER_ACCEPTED`, `ORDER_REJECTED` to
      `ORDER_EVENT_TYPES`; add `ACTIVE`, `REJECTED` to `ORDER_STATUSES`
      (§4). Not strictly required to move a single `OrderEvent` through the
      fan-out itself, but keeping the model in sync with what's agreed
      avoids a second churn pass on this file next session.
- [ ] `backend/controller/order-processing/fanOutOrderEventsController.ts`
      — parses the DynamoDB Streams event, per-item failure reporting.
- [ ] `backend/service/order/orderEvaluationService.ts` (or a smaller
      dedicated file if `fanOutOrderEvent` doesn't naturally belong
      alongside evaluation logic that doesn't exist yet — decide at build
      time) — `fanOutOrderEvent`: relevance check (`INSERT` + `sk` starts
      with `EVENT#`), `unmarshall`, `sns:Publish` with `event_type`
      message attribute.
- [ ] `cdk/data/OrdersTable.ts` — no change needed; `dynamoStream:
      NEW_AND_OLD_IMAGES` already enabled.
- [ ] New SNS topic construct (`Nyc311OrderEventsTopic`), likely under
      `cdk/data/` alongside the table it fans out from, or a new
      `cdk/lambda/` construct file — decide at build time.
- [ ] `cdk/lambda/Nyc311OrderEventFanOutLambda.ts` — new construct, **not**
      the existing (differently-scoped) `Nyc311OrderFanOutLambda.ts` (§3's
      flagged naming collision). Stream event source on `OrdersTable`,
      `batchSize: 100`, `reportBatchItemFailures: true`, `retryAttempts:
      3`, on-failure SQS DLQ — mirrors `Nyc311OrderFanOutLambda.ts`
      structurally.
- [ ] Wire into `cdk/stack/Nyc311Stack.ts`.
- [ ] IAM: stream-read (automatic via `DynamoEventSource`) + `sns:Publish`
      only — no `Orders` table read/write grant.
- [ ] Unit tests (controller, service) + CDK assertion tests (fan-out
      Lambda, SNS topic, event source mapping config) — 90% per-file.
- [ ] `CLAUDE.md` §5.2 `order-processing` wording fix — **already done**
      this session, alongside the design doc.

### Leg 2 — evaluation (SNS → SQS → evaluator) — future session

- [ ] `Nyc311OrderEvaluationQueue` (SQS + DLQ), filtered subscription to
      `Nyc311OrderEventsTopic` (`{event_type: ["ORDER_CREATED"]}`).
- [ ] `OrderEvaluationRule` interface + mock (80/19/1 split, §2).
- [ ] `OrderPriorityAssigner` interface + mock (fixed tier + 24h SLA, §4).
- [ ] `orderEvaluationService.ts`'s `evaluateOrder` — idempotency
      pre-check (`status === "CREATED" && case_id === null`), the three
      outcome branches, `PriorityAssigned` stamp on `ACCEPT`.
- [ ] `backend/controller/order-processing/evaluateOrderController.ts`.
- [ ] `cdk/lambda/Nyc311OrderEvaluationLambda.ts` — `batchSize: 10`,
      `reportBatchItemFailures: true`.
- [ ] CloudWatch alarms: fan-out `IteratorAge`/`Errors`, evaluation DLQ
      depth (§6/§7).
- [ ] `test-scripts/`-style manual sanity script against `Nyc311-Test`
      (§8).
- [ ] Log the DLQ-Case gap (§6) and the Case-mapping deferral (§5) — **already
      logged** in `99-things-to-come-back-to.md` this session.

---

*(All 8 topics now decided or explicitly deferred — see the Decision
Status table above for the two intentionally left that way, §5 and the
DLQ-Case gap noted in §6. Ready to build.)*
