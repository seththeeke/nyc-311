# Project Context: NYC 311

> A learning project simulating a real field-service business, built entirely on AWS,
> that ingests real NYC 311 data, runs it through a dispatch workflow, and demonstrates
> production-grade failure handling, agentic support-case resolution, and a full
> multi-environment CD pipeline.
>
> This document is a starting-point brief for Claude Code. It captures the decisions
> made so far. Sections marked **[OPEN]** are intentionally left for you to define as
> you build — don't let Claude Code invent business-critical details for those without
> checking with you first.

---

## 1. What This Project Is

A fictional field-service dispatch company that resolves real New York City 311 service
requests (noise complaints, sanitation issues, illegal parking, rodents, etc.). The
company is not real and does no actual work — the point is to build the *software*
a real field-service ops company would run: intake, scheduling, dispatch, execution,
failure handling, and a support desk that partly resolves itself and partly escalates
to a human (you).

This is a **learning and portfolio project**. Priorities, in order:
1. Demonstrate a coherent, realistic multi-service AWS architecture.
2. Demonstrate real operational practices: retries, DLQs, error budgets, escalation,
   observability, multi-environment CD.
3. Demonstrate agentic AI use in a support/ops context (not just a chatbot).
4. Be genuinely fun and legible as a portfolio piece — a stranger should be able to
   look at the public site and understand what's happening within 30 seconds.

Service scope is intentionally **broad for now** — ingest all NYC 311 complaint types
unfiltered/lightly filtered, and defer deciding on a specific service vertical
(e.g., "we only do noise complaints") until there's been time to look at real data
volume and patterns. **[OPEN: revisit after initial ingestion is running.]**

---

## 2. Data Source: NYC 311

- **Endpoint:** `https://data.cityofnewyork.us/resource/erm2-nwe9.json` (Socrata SODA API)
- **Auth:** None required for read access. No API key needed. (An optional free
  `X-App-Token` raises rate limits but isn't necessary at this volume.)
- **Volume control:** The raw feed produces a new record roughly every 15–30 seconds
  citywide — far too much for a "few times a day" cadence. Control volume via SoQL
  query params, e.g.:
  - `$where=created_date > 'YYYY-MM-DDTHH:MM:SS'` (only new since last poll)
  - `complaint_type=` / `borough=` filters if/when you narrow scope
  - `$limit=` and `$order=created_date DESC`
- **Polling cadence:** A few times per day (target). Implement via **EventBridge
  Scheduler** triggering a Lambda ("311 Poller") that pulls new records since the last
  successful poll (store last-poll timestamp/cursor in DynamoDB) and emits one event
  per record onto an EventBridge custom bus or SQS queue to kick off the Order Workflow.
  **Sequenced across two slices** (`1-data-ingestion.md`, negotiated 2026-08-10): the
  first slice is raw ingest only — poll, dedup, store as a `draft` Request — with no
  event emission at all, since a `draft` Request was never promoted and there's nothing
  yet for the Order Workflow to act on. The event-bus/queue emission described here
  belongs to whichever later slice actually promotes a Request. `1-data-ingestion.md`
  also designs the cursor storage only gestured at here (§2: a sentinel item inside the
  `Requests` table, not a new table).
- **Record shape (real example):**
  ```json
  {
    "unique_key": "69243509",
    "created_date": "2026-06-05T01:50:27.000",
    "agency": "NYPD",
    "complaint_type": "Noise - Residential",
    "descriptor": "Banging/Pounding",
    "incident_zip": "11355",
    "borough": "QUEENS",
    "latitude": "40.7525...",
    "longitude": "-73.8249...",
    "status": "In Progress"
  }
  ```
- **Real sample data:** `311-test-data/` holds a reusable puller
  (`pull-nyc-311-data.js`) and gitignored sample pulls, used to sanity-check
  the data model against real records rather than guessing at field
  coverage/shape. See `311-test-data/README.md` to refresh, and
  `docs/data-model.md` (Appendix A) for the entity-design conclusions drawn
  from it.

---

## 3. Domain Model (negotiated 2026-07-20)

Six primitives. Two different audit strategies are used deliberately, on
different entities, to demonstrate both patterns:

- **Order** is **fully event-sourced** — there is no independently-mutable
  "status" field; current state is a projection derived by folding its
  `OrderEvent` stream.
- **Case** uses **mutable state + a supplementary append-only audit log**
  (`CaseEvent`) — simpler to reason about, still gives full history.

### 3.1 User

Represents an actor, not necessarily a full account:

- `admin` — the single authenticated operator (Cognito).

`public_actor` (an unauthenticated visitor attributed to public-created
writes) is dropped — see §5's 2026-08-08 amendment. No public write path
exists to attach it to; `data-model.md` already reflects this.

Fields (draft): `user_id`, `type` (`admin`), `created_at`, `cognito_sub`,
`email`.

### 3.2 Location

Normalized location entity — NYC 311 location data is richer than a zip
code (full address, BBL, borough, community board, lat/long), and a given
address can recur across many Requests over time. Also needed cleanly for
the public "register a fake location, generate synthetic Orders against
it" flow.

Fields (draft): `location_id`, `bbl` (real) or a synthetic identifier
(fake), `address`, `borough`, `community_board`, `zip`, `latitude`,
`longitude`, `is_fake`, `registered_by` (`user_id`, null for real
311-derived locations), `created_at`.

Relationship: one Location → many Requests, over time.

### 3.3 Request

The raw intake record for a real ingested NYC 311 record. (Public-submitted
fake requests were part of the original sandbox sketch — dropped, §5's
2026-08-08 amendment.) **Not every Request becomes an Order** — promotion,
filtering, dedup, and rejection are tracked on the Request itself rather
than gating what gets persisted.

Fields (draft): `request_id`, `source` (`nyc_311`), `external_unique_key`
(311's `unique_key`), `location_id` (FK), `complaint_type`, `descriptor`,
`agency`, `raw_payload` (original JSON), `status` (`pending` | `promoted` |
`filtered` | `duplicate` | `rejected`), `created_at`.

Relationship: Request 0..1 → Order (a promoted Request has exactly one
Order; most Requests may never be promoted, especially once scope narrows
per §1's [OPEN] note).

### 3.4 Order (event-sourced)

Represents a dispatched job moving through the Order Workflow
(`Ingest → Schedule → Plan → Execute → Resolve`, §4.1). Two layers:

- **`OrderEvent`** (source of truth, immutable, append-only): `order_id`,
  `sequence_number`, `event_type` (e.g. `OrderCreated`, `StageStarted`,
  `StageSucceeded`, `StageFailed`, `StageRetried`, `FailureInjected`,
  `CaseCreated`, `OrderResolved`, `OrderFailedTerminal`), `stage`
  (nullable — one of the 5 workflow stages), `payload`, `occurred_at`,
  `actor` (`system` | `agent` | `admin`).
- **Order projection** (materialized, read-optimized current-state view —
  *derived*, not independent truth): `order_id`, `request_id` (FK),
  `location_id` (FK), `current_stage`, `status`, per-stage retry counts,
  `case_id` (nullable FK), `created_at`, `updated_at`,
  `last_event_sequence`.

Invariant: the projection must always be re-derivable by replaying
`OrderEvent`s for that `order_id` from sequence 0 — it's a cache, not a
second source of truth.

### 3.5 Case

Created when an Order's workflow fails in a way that needs handling. (The
public-sandbox path — a Case created directly by a public user, no
originating Order — was part of the original sandbox sketch; dropped, §5's
2026-08-08 amendment.) Uses direct mutable state plus a supplementary
event log:

- **Case**: `case_id`, `order_id` (FK), `status` (`created` |
  `under_investigation` | `auto_resolved` | `escalated` |
  `resolved_by_admin` | `closed`), `source` (`order_failure`),
  `created_by` (`user_id`), `assigned_admin` (nullable), `created_at`,
  `updated_at`.
- **`CaseEvent`** (append-only audit log): `case_id`, `sequence_number`,
  `event_type` (`CaseCreated`, `AgentInvestigationStarted`,
  `AgentInvestigationCompleted`, `AutoResolved`, `EscalatedToHuman`,
  `AdminResolved`, `Closed`), `payload`, `occurred_at`, `actor`.

Note: this folds the previously-separate "Agent Investigation" primitive
into `CaseEvent` as an event type — an investigation's model input/output,
action taken, confidence, and reasoning live in the
`AgentInvestigationCompleted` event payload rather than a standalone
table. Still fully satisfies the audit/transparency requirement in §5.

### 3.6 Relationship summary

```
Location <--1:many-- Request
Request --0..1 promotes to--> Order
Order --event stream--> OrderEvent  (source of truth)
Order (projection) <--derived from-- OrderEvent
Order --0..1 spawns--> Case
Case --event log--> CaseEvent
```

**[OPEN]** Exact DynamoDB table design (single-table vs. multi-table), key
schema, and GSIs for the above entities — a good next exercise now that
the entities and their access relationships are defined, still to be
proposed by Claude Code and reviewed by you.

---

## 4. The Two Workflows

### 4.1 Order Workflow (Step Functions state machine #1)
`Ingest → Schedule → Plan → Execute → Resolve`

> **Amended 2026-07-29** — see `docs/capacity-model.md`. The `Plan` stage has been
> removed (`Ingest → Schedule → Execute → Resolve`), and `Schedule` has been
> redefined as the capacity-aware queueing step. That document also splits Case
> handling (§4.2 below) into two owner-specific queues with isolated agents. Treat
> `capacity-model.md` as authoritative over this section where the two disagree.

- Each stage is a Lambda (or set of Lambdas) invoked as a Step Functions task.
- Built-in retry policies per stage (exponential backoff, max attempts) using Step
  Functions' native `Retry` blocks.
- On exhausted retries or a caught unrecoverable error at any stage, the workflow
  transitions to a **"Create Case"** step instead of failing silently — this hands off
  to the Case Workflow and marks the Work Order as blocked/pending-case.
- Failure modes should be **injectable**, not just theoretical — see Section 6.

### 4.2 Case Workflow (Step Functions state machine #2)
`Case Created → Agentic Investigation → (Auto-Resolve | Escalate to Human) → Closed`

- Triggered whenever the Order Workflow creates a Case, or when a public user files a
  fake case directly.
- **Agentic Investigation step:** invokes **Amazon Bedrock** (Claude) with context
  about the Case — what failed, at what stage, what the original 311 record was, prior
  similar cases if useful — and asks it to either (a) resolve the case autonomously
  with a specific action, or (b) escalate with a reasoned explanation of why a human
  is needed.
- Auto-resolution actions should be constrained to a small, explicit action set (e.g.,
  "retry with adjusted parameters," "mark as duplicate," "close as no-action-needed")
  rather than open-ended — this keeps the agent auditable and keeps failure modes
  bounded, which matters both for realism and for safely demoing this publicly.
- Escalated cases appear in your authenticated Admin view for manual resolution.
- Every agent decision is logged (model input/output, action taken, confidence) for
  the metrics/observability layer and for public transparency (Section 5).

**[OPEN]** Exact Bedrock model, prompt structure, and the bounded action set — worth
designing carefully once you see real failure patterns rather than guessing upfront.

---

## 5. Public Site (single React + Vite SPA)

> **Amended 2026-08-08** — the public-write "sandbox" tier (create a fake
> Case, track it live) originally sketched below is **dropped, not just
> deferred**. `data-model.md`'s [Deferred](data-model.md#deferred--out-of-scope-for-now)
> section already removed `User.type = public_actor`,
> `Request.source = public_demo`, and `Case.case_type = public_demo` from
> the active data model (2026-07-29) on the same reasoning: no public write
> path exists to attach them to. This amendment aligns §5 itself, which
> still described the old tier as if active. In its place, "Public
> dashboard" absorbs the portfolio "show off" role the sandbox was meant to
> serve — a read-only birds-eye view (metrics + live incident/vehicle map +
> an "About This" explainer page) rather than a public write flow. Two
> public tiers now, not three.

| Tier | Who | Can do |
|---|---|---|
| Public dashboard | Anyone | Read-only birds-eye view: aggregate metrics (order volume, resolution rates, error/case rates, borough/category breakdowns), a live map of incidents and vehicle/operator tracking (same map component the Admin uses, no controls), resource/shift stats, and an "About This" page explaining the simulation. |
| Public admin view | Anyone | Read-only mirror of everything the Admin can see — full transparency, portfolio-friendly |
| Admin | You (authenticated) | Everything above, plus: manually resolve escalated Cases, trigger/toggle failure injection, manage service catalog, view raw execution history |

- **Auth:** Amazon Cognito for the Admin login. Public tiers are unauthenticated,
  read-only, and rate-limited (API Gateway usage plans / throttling, and consider
  AWS WAF) — no public write path exists (see amendment above).
- Hosting: S3 + CloudFront for the SPA; API Gateway + Lambda for the API layer.

---

## 6. Failure Injection ("Chaos" Testing)

Since observing and simulating failures is a core goal, build this in as a first-class
feature, not an afterthought:

- Each Order Workflow stage Lambda supports a **failure-injection mode**, toggleable
  by the Admin (e.g., via a DynamoDB config item or Parameter Store flag), covering at
  minimum: timeout, validation error, simulated downstream 5xx, throttling/rate-limit
  error, and malformed data.
- Injected failures should behave exactly like real ones — same retry policy, same
  Case-creation path — so your metrics and Case Workflow are exercised the same way
  they'd be exercised by a genuine production issue.
- Consider a "chaos schedule" (e.g., inject an X% failure rate on stage Y for the next
  N minutes) so you can watch the system respond in real time rather than
  single-shooting failures manually.

---

## 7. Tech Stack Summary

| Layer | Choice |
|---|---|
| Language | TypeScript (backend and frontend) |
| IaC | AWS CDK (TypeScript) |
| CI/CD | AWS CodePipeline + CodeBuild |
| Environments | Single AWS account; `test` and `prod` environments via separate CDK stacks/namespacing |
| Database | DynamoDB |
| Orchestration | AWS Step Functions (2 state machines: Order Workflow, Case Workflow) |
| Ingestion trigger | EventBridge Scheduler |
| Queueing/retry | SQS + DLQ |
| Agentic resolution | Amazon Bedrock (Claude) |
| Auth | Amazon Cognito (Admin only) |
| API | API Gateway + Lambda |
| Frontend | React + Vite (SPA), hosted on S3 + CloudFront |
| Observability | CloudWatch (metrics, dashboards, alarms), X-Ray tracing |
| Testing | Unit tests (Vitest/Jest), CDK assertion tests, integration tests against `test` env |

---

## 8. CD Pipeline (target shape)

- CodePipeline stages: **Source → Build/Test (CodeBuild) → Deploy to `test` → Automated
  integration tests against `test` → Manual approval (optional) → Deploy to `prod`**.
- CodeBuild runs: lint, unit tests, CDK synth, CDK assertion tests.
- Consider a `cdk diff` step surfaced before prod deploy for visibility into what's
  about to change — good practice to demonstrate and genuinely useful.
- **[OPEN]** Source repo host (GitHub via CodeStar Connections, or CodeCommit-adjacent
  alternative since CodeCommit is being phased out — confirm current AWS guidance here
  before building, since this may have changed).

---

## 9. Metrics to Track

- Order Workflow: volume by stage, per-stage error rate, retry counts, time-in-stage,
  end-to-end resolution time.
- Case Workflow: case volume, auto-resolve rate vs. escalation rate, time-to-resolution,
  agent confidence distribution, human-resolution time once escalated.

---

## 10. Suggested Build Order

1. NYC 311 poller Lambda + EventBridge Scheduler + DynamoDB cursor storage (get real
   data flowing before building anything else). Fully designed in
   `1-data-ingestion.md` — scope, cursor design, backfill/pagination, failure
   handling, ID scheme, testing, and observability are all decided there.
2. Order Workflow Step Functions state machine with the 5 stages as stub Lambdas
   (no real logic yet — just prove the state machine, retries, and Case-creation
   handoff work).
3. Case Workflow state machine with a stubbed (non-agentic) resolution step, to prove
   the Case lifecycle and escalation path end-to-end.
4. Swap the stub resolution step for the real Bedrock/Claude agentic step.
5. Failure injection framework on the Order Workflow stages.
6. Admin API + authenticated Admin UI (read/write).
7. Public dashboard (birds-eye metrics + live map) + read-only public admin mirror.
8. CodePipeline/CodeBuild CD pipeline with `test`/`prod` promotion.
9. Observability dashboards and alarms.

---

## 11. Explicit Non-Goals

- No real work is performed — this is a simulation. No real dispatch, no real crews.
- No PII collection — the public tiers are read-only (§5's 2026-08-08 amendment), so
  this is largely moot, but keep it in mind if a public write path ever comes back.
- Not attempting to replicate NYC's actual 311 resolution process — the "resolution"
  logic in this system is entirely fictional/simulated.