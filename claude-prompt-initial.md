# Project Context: [Working Title] Civic Field Services

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

---

## 3. Domain Model (starting point)

- **Work Order** — created from an ingested 311 record. Represents a dispatched job.
- **Case** — created when a Work Order's workflow fails in a way that needs handling
  (exhausted retries, unrecoverable error, ambiguous state). Has its own lifecycle,
  independent of the originating Work Order.
- **Property/Location** — derived from the 311 record's address/borough/zip. Public
  users can also register a fake property to generate synthetic Work Orders against.
- **Agent Investigation** — a record of what the AI agent did when investigating a
  Case: what it concluded, what action it took or recommended, confidence, and whether
  it escalated.

**[OPEN]** Exact DynamoDB table design (single-table vs. multi-table), key schema,
and GSIs — this is a good early exercise for Claude Code to propose and for you to
review, given DynamoDB access-pattern-first design.

---

## 4. The Two Workflows

### 4.1 Order Workflow (Step Functions state machine #1)
`Ingest → Schedule → Plan → Execute → Resolve`

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

One site, three tiers of visibility:

| Tier | Who | Can do |
|---|---|---|
| Public dashboard | Anyone | Read-only view of real aggregate metrics: order volume, resolution rates, error/case rates, borough/category breakdowns |
| Public sandbox | Anyone | Create a **fake** Case via a public API endpoint, track it live through the Case Workflow (agentic investigation → resolve/escalate), see the outcome |
| Public admin view | Anyone | Read-only mirror of everything the Admin can see — full transparency, portfolio-friendly |
| Admin | You (authenticated) | Everything above, plus: manually resolve escalated Cases, trigger/toggle failure injection, manage service catalog, view raw execution history |

- **Auth:** Amazon Cognito for the Admin login. Public tiers are unauthenticated but
  should be rate-limited (API Gateway usage plans / throttling, and consider AWS WAF)
  since public users can write data (fake cases).
- Fake cases created by the public should be clearly namespaced/flagged (e.g., a
  `source: "public_demo"` field) so they never get mixed into real 311-derived metrics.
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
- Public sandbox: fake-case volume and outcomes (kept separate from real metrics).

---

## 10. Suggested Build Order

1. NYC 311 poller Lambda + EventBridge Scheduler + DynamoDB cursor storage (get real
   data flowing before building anything else).
2. Order Workflow Step Functions state machine with the 5 stages as stub Lambdas
   (no real logic yet — just prove the state machine, retries, and Case-creation
   handoff work).
3. Case Workflow state machine with a stubbed (non-agentic) resolution step, to prove
   the Case lifecycle and escalation path end-to-end.
4. Swap the stub resolution step for the real Bedrock/Claude agentic step.
5. Failure injection framework on the Order Workflow stages.
6. Admin API + authenticated Admin UI (read/write).
7. Public dashboard + public sandbox (read-only + fake-case creation).
8. CodePipeline/CodeBuild CD pipeline with `test`/`prod` promotion.
9. Observability dashboards and alarms.

---

## 11. Explicit Non-Goals

- No real work is performed — this is a simulation. No real dispatch, no real crews.
- No PII collection from public users beyond what's needed for the demo sandbox
  (and even then, keep it minimal — this is a portfolio project, not a product).
- Not attempting to replicate NYC's actual 311 resolution process — the "resolution"
  logic in this system is entirely fictional/simulated.