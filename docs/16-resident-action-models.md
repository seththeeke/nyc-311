# 16. Resident Action Models

**Status:** designed 2026-10-31; being built leg by leg (§8). Supersedes the 2026-10-24 Contact-only draft of this doc (`16-resident-contact.md`).

Tracking: [#110](https://github.com/seththeeke/nyc-311/issues/110) (Contacts) and [#111](https://github.com/seththeeke/nyc-311/issues/111) (resident actions).

This doc defines how residents (`13-customer-simulation.md`) act on their ideas, and what BoroughSim exposes for them to act on. It is the foundation for every later resident action.

---

## 1. Overview

| Piece | Owner | What it is |
|---|---|---|
| **Public API** | BoroughSim | A versioned, documented HTTP API for outside callers at `public-api.boroughsim.com/v1/`, separate from the web-app's internal endpoints (§2). |
| **Contact** | BoroughSim | A domain entity for someone reaching BoroughSim. Feature requests are Contacts of type `FEATURE_REQUEST` (§3). |
| **Usage data** | BoroughSim | One warehouse row per public API call (§4). |
| **Action loop** | Customer | Per idea, an LLM loop in which the resident picks deterministic tools over the public API until it finishes the idea, recorded as a step-by-step workstream (§5). |
| **UI** | BoroughSim web-app | Idea Resolution on each idea, and a Public API page under Monitoring (§6). |

The two stacks stay decoupled. BoroughSim ships the public API through the pipeline (Test, then Prod). The customer stack calls it only at its public Prod URL and imports no BoroughSim code; it keeps its own copies of the request and response shapes.

---

## 2. The public API

### 2.1 Contract

- **Host:** its own API Gateway HTTP API, `Nyc311PublicApi-{Test,Prod}`, at `public-api.test.boroughsim.com` and `public-api.boroughsim.com`. Every route is under `/v1/`.
- **Separate from internal endpoints.** `api.boroughsim.com` serves the web-app's screens and changes with them. The public API is a stable contract for outside callers.
- **No auth.** No authorizer, API key or usage plan.
- **Hides internal models.** Public resources are named for what a caller does (`feature-requests`), not for how BoroughSim stores it (Contact).
- **Documented by a hand-maintained OpenAPI spec** (§2.5).
- **Claude's rules for changing it** are in `.claude/API.md`.

### 2.2 Conventions (every `/v1/` route)

| Topic | Rule |
|---|---|
| Field case | `snake_case`. Enum values `ALL_CAPS`. |
| `X-Requester` (request) | Required. Identifies the calling client, e.g. `resident:hawthorn`, `integration-test`. Format `^[a-z0-9][a-z0-9:._-]{0,63}$`, checked; identity not checked. Missing or malformed: `400 INVALID_REQUESTER`. |
| `Idempotency-Key` (request) | Optional on POSTs that create. 8–128 characters of `[A-Za-z0-9_-]`. Keys are global, so callers use UUIDs. |
| `X-Call-Id` (response) | On every response, success or error: a ULID identifying this call. It is the `call_id` of the usage row (§4). |
| Single resource | The object itself, with no wrapper. |
| Lists | `{ "items": [...], "next_cursor": "…" \| null }`. `limit` defaults to 20, maximum 50. The cursor is opaque base64url; a cursor from a different query is a `400`. |
| Errors | `{ "error": { "code": "…", "message": "…", "details": [{ "field": "…", "issue": "…" }] } }`; `details` only on `VALIDATION_ERROR`. Codes: `VALIDATION_ERROR` (400), `INVALID_REQUESTER` (400), `NOT_FOUND` (404), `INTERNAL_ERROR` (500). A 5xx never carries internal detail. API Gateway's own 429 body is not ours. |
| Versioning | Additive only within `/v1/`. A breaking change gets `/v2/`. Clients ignore fields they don't recognize. |
| CORS | Any origin; `GET`, `POST`; allows `Content-Type`, `X-Requester`, `Idempotency-Key`; exposes `X-Call-Id`. |
| Throttles | API default 5 requests/second, burst 10. `POST /v1/feature-requests`: 1, burst 3. |

### 2.3 Layering

The public API sits on top of the domain layers and never reaches past them.

```
controller/web-api/publicV1/   one bundle, one Lambda: router, route list, one controller per route
        │  (every controller calls publicApiService, even for a pass-through)
        ▼
service/publicApi/publicApiService.ts   public model → domain call → public model
        │  (domain services only, never a DAO)
        ▼
service/contact/, service/order/, service/location/   domain services
        ▼
dao/contact/, dao/order/, dao/location/
```

- Public request and response models live in `models/publicApi/`, each with its own zod schema. Domain models (`models/contact.ts`, `models/order.ts`, …) never import them.
- Feature requests are the first example: `FeatureRequest` → `contactService.createContact` (Contact of type `FEATURE_REQUEST`) → `Contact` → the `FeatureRequest` response. The caller never sees a Contact.
- Internal web-app endpoints may keep calling domain services directly; the public layer is a pattern, not a rule for every endpoint.
- Enforced by lint (`backend/eslint.config.js`):
  - `service/publicApi/**` imports no `dao/`.
  - Nothing outside `service/publicApi/` and `controller/web-api/publicV1/` imports `models/publicApi/` or `service/publicApi/`.
  - The `publicV1` bundle imports `service/publicApi/` and no other service.

### 2.4 Operations

| Operation | Route | Throttle |
|---|---|---|
| `SEARCH_REQUESTS` | `POST /v1/requests/search` | default |
| `CREATE_FEATURE_REQUEST` | `POST /v1/feature-requests` | 1 / burst 3 |
| `GET_FEATURE_REQUEST` | `GET /v1/feature-requests/{feature_request_id}` | default |
| `GET_OPENAPI_SPEC` | `GET /v1/openapi.yaml` | default |

#### 2.4.1 `POST /v1/requests/search`

Finds a resident's 311 complaint as BoroughSim is handling it.

```json
{ "search_params": { "order_id": "01K7XWQ2B9N4M8F3T6RZ0Y5DKA" }, "limit": 20 }
```

- `search_params` grows additively (311 number, borough, descriptor, date range, …). In v1, `order_id` is the only filter and is required.
- `order_id` must be a ULID (`^[0-9A-HJKMNP-TV-Z]{26}$`), or `400 VALIDATION_ERROR`.
- `200` with `{ items, next_cursor }`. A well-formed id that matches no Order returns `items: []`.
- **Source: Order and Location only.** `orderService.getOrder` (a `GetItem` on `Orders`), then `locationService.getLocation` (a `GetItem` on `Locations`). No Request read, no index.

An item:

```json
{
  "order_id": "01K7XWQ2B9N4M8F3T6RZ0Y5DKA",
  "request_id": "01K7XW9F0C2A7K5D8S3TQ1M4EB",
  "complaint_type": "Street Condition",
  "borough": "BROOKLYN",
  "address": "412 ATLANTIC AVENUE",
  "zip": "11217",
  "status": "SCHEDULED",
  "status_reason_description": null,
  "scheduled_window": { "start": "2026-11-03T13:00:00.000Z", "end": "2026-11-03T15:00:00.000Z" },
  "received_at": "2026-10-14T14:03:11.000Z",
  "status_updated_at": "2026-11-02T09:10:00.000Z"
}
```

- `address`, `borough` and `zip` are `null` when the Order has no Location (rejected `LOCATION_UNRESOLVED`).
- `scheduled_window` is `null` until the Order is scheduled.
- `received_at` is the Order's `created_at`; `status_updated_at` is its `updated_at`.
- Never exposed: SLA deadline, priority tier, assigned operator, internal stage, retry counts, costs, case id, `location_id`, BBL, community board, latitude, longitude.

Public status, derived from the Order:

| Order | `status` | `status_reason_description` |
|---|---|---|
| `status` `REJECTED` | `NOT_SERVICED` | `SERVICE_NOT_SUPPORTED`: "This type of request isn't serviced." `LOCATION_UNRESOLVED`: "The location of this request couldn't be resolved." |
| `status` `CREATED` | `RECEIVED` | null |
| stage `SCHEDULE`, no `scheduled_start` | `ACCEPTED` | null |
| stage `SCHEDULE`, `scheduled_start` set | `SCHEDULED` | null |
| stage `EXECUTE` | `IN_PROGRESS` | null |
| stage `RESOLVE` | `RESOLVED` | null |
| anything else (stage `INGEST`) | `RECEIVED` | null |

#### 2.4.2 `POST /v1/feature-requests`

Headers: `X-Requester`, optional `Idempotency-Key`.

```json
{
  "title": "Text me when a repair near me is scheduled",
  "description": "I ride past these every night. Let me subscribe to a street and get a text when work is booked.",
  "submitted_by": { "name": "Hawthorn", "email": null }
}
```

| Field | Limits |
|---|---|
| `title` | 5–120 characters |
| `description` | 10–2000 characters |
| `submitted_by.name` | 1–80 characters, required |
| `submitted_by.email` | optional, a valid email or `null` |
| Body | ≤ 8 KB |

`201` with the feature request (below). A retry with the same `Idempotency-Key` returns the original feature request with `201`, whatever its body; bodies are not compared.

#### 2.4.3 `GET /v1/feature-requests/{feature_request_id}`

`200` with the feature request; a malformed id is `400 VALIDATION_ERROR`; an unknown id is `404 NOT_FOUND`.

The feature request (both routes):

```json
{
  "feature_request_id": "01K8C4T1W7H3P9N2M6QZ8V0RJD",
  "status": "RECEIVED",
  "status_reason_description": null,
  "title": "Text me when a repair near me is scheduled",
  "description": "I ride past these every night. …",
  "submitted_by": { "name": "Hawthorn" },
  "created_at": "2026-11-02T22:14:02.000Z",
  "updated_at": "2026-11-02T22:14:02.000Z"
}
```

| Contact | Feature request |
|---|---|
| `contact_id` | `feature_request_id` |
| `status` `RECEIVED` / `IN_PROGRESS` / `CLOSED` | `status` `RECEIVED` / `UNDER_REVIEW` / `CLOSED` |
| `closure_reason_description` | `status_reason_description` |
| `submitter.name` | `submitted_by.name` |
| `submitter.email`, `client_request_id`, `contact_type` | never returned |

`X-Requester` is not stored on the Contact. Nothing in a Contact says who the calling client was.

### 2.5 OpenAPI spec

- **Hand-maintained** at `backend/controller/web-api/publicV1/openapi.yaml` (OpenAPI 3.1), written before the operations are built; the API is built to it.
- **Served** by the API at `GET /v1/openapi.yaml` (bundled into the Lambda).
- **Kept honest by tests** in `backend/`: the spec's paths and methods equal `publicV1ApiRoutes.ts` exactly, and every example in the spec parses through the matching `models/publicApi/` zod schema.
- **Rendered** on the web-app's Public API page with lazy-loaded Swagger UI (§6.2).

---

## 3. The Contact domain model

A Contact is someone reaching BoroughSim. `contact_type` classifies it; the first type is `FEATURE_REQUEST`. Contact is separate from Case (a system-raised trouble ticket); the two are not linked.

### 3.1 Table `Contacts-{Test,Prod}`

Partition key `contact_id` (string), no sort key, no index. Plain `Dao<Contact>`. Retained on stack deletion, like every domain table.

Contact row:

```json
{
  "contact_id": "01K8C4T1W7H3P9N2M6QZ8V0RJD",
  "contact_type": "FEATURE_REQUEST",
  "status": "RECEIVED",
  "title": "Text me when a repair near me is scheduled",
  "description": "I ride past these every night. Let me subscribe to a street and get a text when work is booked.",
  "submitter": { "name": "Hawthorn", "email": null },
  "closure_reason_code": null,
  "closure_reason_description": null,
  "client_request_id": "b6f0c1e2-7a4d-4c1e-9d55-2f0e8c3a9b11",
  "created_at": "2026-11-02T22:14:02.000Z",
  "updated_at": "2026-11-02T22:14:02.000Z"
}
```

- `contact_id` is a ULID. `contact_type`: `FEATURE_REQUEST`. `status`: `RECEIVED`, `IN_PROGRESS`, `CLOSED`; only `RECEIVED` is written today.
- `closure_reason_code` and `closure_reason_description` are `null` until `CLOSED`.
- `client_request_id` is the idempotency key, or `null` when the caller sent none.
- No user agent, IP or caller identity is stored.

Idempotency pointer row, written only when `client_request_id` is set:

```json
{ "contact_id": "CRID#b6f0c1e2-7a4d-4c1e-9d55-2f0e8c3a9b11", "target_contact_id": "01K8C4T1W7H3P9N2M6QZ8V0RJD", "created_at": "2026-11-02T22:14:02.000Z" }
```

### 3.2 `contactService`

- `createContact(input)`: writes the Contact and, when `client_request_id` is set, the pointer row, in one transaction, each conditioned on `attribute_not_exists(contact_id)`. If the pointer already exists, it reads the pointer and returns the original Contact.
- `getContact(contact_id)`: `GetItem`; `NotFoundError` when missing. A `CRID#` key is never a valid `contact_id`.

---

## 4. Public API usage data

- **Health:** API Gateway's built-in metrics for `Nyc311PublicApi` (count, 4xx, 5xx, latency). Per API, so they cover only the public API. No custom metrics, metric filters or detailed route metrics.
- **Usage:** Glue table **`public_api_calls`** in the warehouse, one row per call. After each call the router publishes the row to an SNS topic, best-effort (a failed publish is logged and never fails the call); the existing `Nyc311WarehouseFirehose` construct lands it as Parquet.

| Column | Type | Example |
|---|---|---|
| `call_id` | string | `01K8D2…` (also the `X-Call-Id` header) |
| `requester` | string | `resident:hawthorn` |
| `operation` | string | `SEARCH_REQUESTS` |
| `route_key` | string | `POST /v1/requests/search` |
| `status_code` | int | `200` |
| `outcome` | string | `SUCCESS`, `CLIENT_ERROR` or `SERVER_ERROR` |
| `latency_ms` | int | `84` |
| `request_params` | string | `order_id=01K7XWQ2B9N4M8F3T6RZ0Y5DKA` (filters flattened; free text never stored) |
| `result_count` | int, nullable | `1` (searches) |
| `resource_id` | string, nullable | the feature request id (feature-request operations) |
| `occurred_at` | string | ISO timestamp |

A call with a missing or malformed `X-Requester` is recorded with `requester` `UNKNOWN`.

---

## 5. The resident action loop

### 5.1 Tools

**The model chooses; tools are deterministic.** A tool is a fixed bundle of code: given the same input it makes the same calls and records the same result. The model's only job is a personality-driven choice, made from the idea and its workstream so far: which tool to call next, or to finish. Wherever an input can come from data, the recipe fills it in; whatever the model supplies, the recipe checks.

| Tool | Bucket | Calls | Model supplies | Recipe fills in | Max per idea |
|---|---|---|---|---|---|
| `SEARCH_REQUESTS` | `REQUESTS` | `POST /v1/requests/search` | nothing | `order_id` from the idea's anchor | 3 |
| `CREATE_FEATURE_REQUEST` | `FEATURE_REQUESTS` | `POST /v1/feature-requests` | `title`, `description` | `submitted_by.name` (resident name); `Idempotency-Key` from `idea_id` and step | 1 |
| `GET_FEATURE_REQUEST` | `FEATURE_REQUESTS` | `GET /v1/feature-requests/{id}` | `feature_request_id`, unless the idea is anchored to one | the anchor's id; rejects an id the resident didn't file, without calling the API | 2 |
| `BROWSE_WEBSITE` | `WEBSITE` | reserved for RPA | — | — | — |

- Every call sends `X-Requester: resident:<persona_id>` to `https://public-api.boroughsim.com`.
- A tool is offered only when it can run: `SEARCH_REQUESTS` needs an order anchor; `GET_FEATURE_REQUEST` needs a feature request the resident filed.
- Every resident is granted `REQUESTS` and `FEATURE_REQUESTS`, with `action_weights` set per persona in its seed; weights are described to the model as preferences.

### 5.2 The loop

1. **Trigger.** After writing an idea, the idea worker sends `{ persona_id, idea_id }` to `IdeaActions-Prod` (DLQ `IdeaActionsDlq-Prod`, no alarm). `CustomerActionWorker-Prod` consumes it with `maxConcurrency` 2, a 3-minute timeout, and a visibility timeout above that.
2. **One Converse conversation per idea**, on the resident's `model_id`. System prompt `idea-actioner@1`, assembled at seed sync and stored on the resident. First user turn: the idea and its anchor. Tools offered: those granted, runnable and under their cap, plus **`finish_idea`**.
3. **Each turn** the model either calls a tool (the recipe runs it; the result goes back as a `toolResult`) or calls `finish_idea { resolution, summary, follow_up? }`, where `resolution` is `SATISFIED`, `UNSATISFIED` or `GAVE_UP`. A failed tool call (4xx, 5xx, or a recipe check) is recorded `FAILED` and returned to the model as an error result. Finishing on the first turn is allowed.
4. **Max depth:** 5 tool calls and 8 model turns per idea, plus the per-tool caps. When a limit is reached, the next turn forces `finish_idea` through `toolChoice`; if the model still doesn't finish, the loop records `FORCED_FINISH` with resolution `MAX_DEPTH_REACHED`.
5. **Checkpointing.** Each step is saved before the next turn (§5.3). A redelivered message rebuilds the conversation from the saved steps and continues; a finished idea is skipped. Bedrock throttling throws and the queue redelivers.

### 5.3 The workstream

An idea's work is an append-only **step log** plus a **`resolution` summary** on the idea row, both in `ResidentIdeas-Prod`.

**Keys.** Steps share their idea's sort key as a prefix, so one query returns the idea followed by its steps in order:

```
persona_id = hawthorn
  sk = IDEA#01K7Z3M8Q4D2V6T9R1XB5C0EHN              idea row, with resolution
  sk = IDEA#01K7Z3M8Q4D2V6T9R1XB5C0EHN#STEP#0001    step 1
  sk = IDEA#01K7Z3M8Q4D2V6T9R1XB5C0EHN#STEP#0002    step 2
  sk = ORDER#01K7XWQ2B9N4M8F3T6RZ0Y5DKA             order thread
  sk = FEATURE_REQUEST#01K8C4T1W7H3P9N2M6QZ8V0RJD   feature-request thread
```

**Indexes.** `ByResident` (partition `resident_pk` = `persona_id`, sort `idea_id`) is set only on idea rows and serves a resident's ideas, newest first. `Feed` and `ByOrder` are unchanged. Step and thread rows carry no index attributes.

**Step row** (one per model turn; written once):

```json
{
  "persona_id": "hawthorn",
  "sk": "IDEA#01K7Z3M8Q4D2V6T9R1XB5C0EHN#STEP#0002",
  "idea_id": "01K7Z3M8Q4D2V6T9R1XB5C0EHN",
  "sequence": 2,
  "kind": "TOOL_CALL",
  "decision": {
    "tool": "SEARCH_REQUESTS",
    "input": {},
    "model_text": "Let me see if they've actually booked the trench outside the shop."
  },
  "execution": {
    "status": "COMPLETED",
    "summary": "Found it: scheduled 3 Nov, 13:00–15:00.",
    "request": { "method": "POST", "path": "/v1/requests/search", "body": { "search_params": { "order_id": "01K7XWQ2B9N4M8F3T6RZ0Y5DKA" } } },
    "response": { "status_code": 200, "call_id": "01K8D2…", "body": { "items": [], "next_cursor": null } },
    "started_at": "2026-11-02T22:14:01.000Z",
    "completed_at": "2026-11-02T22:14:01.420Z"
  },
  "input_tokens": 940,
  "output_tokens": 38,
  "created_at": "2026-11-02T22:14:01.420Z"
}
```

- `kind`: `TOOL_CALL` (decision and execution), `FINISH` (the `finish_idea` call; no execution), `FORCED_FINISH` (closed by the loop at max depth).
- `execution.status`: `COMPLETED` or `FAILED`. A recipe check failure has `response` `null` and an `error` message.
- Response bodies are truncated to 4 KB per step.

**`resolution`** on the idea row, replacing the idea's former `status` and `actions[]`:

```json
"resolution": {
  "status": "SATISFIED",
  "summary": "They've booked the trench for Tuesday morning. Fine. I'll believe it when the vans can park.",
  "follow_up": null,
  "tools_used": ["SEARCH_REQUESTS"],
  "step_count": 2,
  "last_step_sequence": 2,
  "started_at": "2026-11-02T22:14:00.000Z",
  "finished_at": "2026-11-02T22:14:03.000Z",
  "prompt_version": "idea-actioner@1",
  "input_tokens": 1810,
  "output_tokens": 112
}
```

- `status`: `NOT_ACTIONED` → `IN_PROGRESS` → `SATISFIED` | `UNSATISFIED` | `GAVE_UP` | `MAX_DEPTH_REACHED`.
- Each step write and the `resolution` update are one transaction, conditioned on `resolution.last_step_sequence`, so a step is never written twice or out of order.

**Access patterns**

| # | Pattern | Query |
|---|---|---|
| A3 | A resident's ideas, newest first | `ByResident`, `resident_pk = :persona`, descending |
| A12 | Every resident's ideas, newest first | `Feed` (unchanged) |
| R1 | One idea with its workstream (Idea Detail; worker resume) | base table, `persona_id = :p AND begins_with(sk, "IDEA#<idea_id>")`, ascending |
| R2 | A resident's feature requests | base table, `begins_with(sk, "FEATURE_REQUEST#")` |

`GET /residents/{personaId}/ideas/{ideaId}` returns the idea with `steps[]` from R1.

### 5.4 Resident memory

- **Feature-request threads.** `FEATURE_REQUEST#<feature_request_id>` rows: `feature_request_id`, `title`, `filed_by_idea_id`, `last_known_status`, `last_known_status_reason`, `last_checked_at`, `created_at`. Created in the transaction of a successful `CREATE_FEATURE_REQUEST` step; updated by each `GET_FEATURE_REQUEST` step.
- **Order threads.** A successful `SEARCH_REQUESTS` step writes `last_known_status`, `scheduled_window` and `last_checked_at` onto the resident's `ORDER#` row.
- **Idea generator `idea-generator@2`.** Its context adds the resident's open feature requests with their last known status (up to 5) and each recent idea's `resolution.summary` and `follow_up`. `record_idea` takes an optional `feature_request_id` (one of those offered, or `NONE`); an idea so anchored gets `GET_FEATURE_REQUEST` with the id filled in.

---

## 6. UI

### 6.1 Idea Resolution (Residents pages)

- **Idea cards:** a resolution badge ("Satisfied", "Unsatisfied", "Gave up", "Hit the limit", "Working on it…", "Stalled" when `IN_PROGRESS` for over an hour, "Not actioned") and tool chips from `tools_used`.
- **Idea Detail:** an **Idea Resolution** section with an outcome header (badge, the resident's `summary` as a quote, `follow_up`, start time, duration, step count) and a vertical timeline, one node per step: the decision (tool chip, the model's text as a quote), the execution (its plain-language `summary`, a `COMPLETED`/`FAILED` pill, latency, and a Request/Response disclosure with the exchange and `X-Call-Id`), ending with the finish.
- The web-app's `residentIdea` model carries `resolution` on every idea and `steps` on the detail. Mock data has one example per resolution, including a failed call and `MAX_DEPTH_REACHED`.

### 6.2 Monitoring → Public API (`/monitoring/public-api`)

One page, three sections:

1. **Overview** — the API as a product: what it is for, the base URL, a card per operation, `X-Requester`, idempotency, limits, and a `curl` example per operation.
2. **Health** — the last 24 hours of `Nyc311PublicApi`'s built-in metrics (count, 4xx, 5xx, latency p50/p99), read through the internal monitoring-bundle route `GET /public-api/metrics`.
3. **Reference** — Swagger UI, lazy-loaded, rendering `/v1/openapi.yaml`, with "Try it".

---

## 7. Deferred

- The web-app feature-request form and a Contacts tab, and whether the form posts to `/v1/` or an internal route (it uses `contactService` either way); a Contacts list index; closure reason codes; a Contacts warehouse leg.
- A Usage section on the Public API page and a rollup over `public_api_calls`.
- Live updates of an in-progress idea (WebSocket-style, alongside throttling how fast residents resolve ideas).
- Per-resident outcome counters.
- An alarm on `IdeaActionsDlq-Prod`.
- `descriptor`, `external_unique_key` and `reported_at` on search results (would be denormalized onto the Order at creation).
- More search filters; `BROWSE_WEBSITE`.

---

## 8. Build plan

One local commit or more per leg, in this order; each passes build, lint, tests and the 90% coverage gate for every package it touches. Commits are pushed periodically.

| Leg | Contents | Packages | Status |
|---|---|---|---|
| L0 | This doc; CLAUDE.md §5.2/§5.3 and `.claude/API.md`; Contact in `data-model.md` | docs | |
| B1 | Search Requests domain: `orderService.getOrder`, `locationService.getLocation` | backend | |
| B2 | Feature Requests domain: `Contacts` table, Contact model, `contactDao` (with `CRID#` pointer), `contactService` | backend, cdk | |
| B3 | OpenAPI spec, `models/publicApi/` schemas, `publicV1ApiRoutes.ts`, parity tests | backend | |
| B4 | Public API foundation: `Nyc311PublicApi` and domains, CORS, throttles, the `publicV1` bundle Lambda and router, `X-Requester`, `X-Call-Id`, errors, `publicApiService`, `GET /v1/openapi.yaml`, lint rules | backend, cdk | |
| B5 | `POST /v1/requests/search` | backend, cdk | |
| B6 | `POST /v1/feature-requests`, `GET /v1/feature-requests/{id}` | backend, cdk | |
| B7 | Pipeline integration tests for every `/v1/` route against Test | backend, cdk | |
| B8 | `public_api_calls`: SNS topic, Firehose, Glue table, router publish | backend, cdk | |
| B9 | Monitoring → Public API page and `GET /public-api/metrics` | web-app, backend, cdk | |
| C1 | `ByResident` index, `resident_pk` on new ideas, backfill script | customer/backend, cdk | |
| C2 | Ideas read from `ByResident`; `resolution` and step rows; idea detail with `steps[]` | customer/backend | |
| C3 | The action loop (§5.1–§5.2) | customer/backend, cdk | |
| C4 | Resident memory (§5.4) | customer/backend | |
| W1 | Idea Resolution UI (§6.1) | web-app | |

Ordering constraints: C2 ships only after C1 is deployed to Prod and its backfill has run. C3 ships only after B5 and B6 are live in Prod.

---

## Appendix A. Decision record (2026-10-31)

Agreed in one design session, concept by concept. Kept for the reasoning; the sections above are the spec.

- **Public API vs. internal endpoints.** Internal routes serve web-app screens and may change with the UI; a resident's tool recipes would break silently on a UI refactor. A separate contract (additive versioning, public-safe fields) mirrors how the webhook payloads separate public from internal events.
- **Own HTTP API, not `/v1/` on `api.boroughsim.com`.** First chosen as a prefix on the existing API; changed because API Gateway's built-in metrics are per API, so only a separate API isolates public-API health at no cost. It also gives the public API its own CORS (needed for `X-Requester` and browser "Try it") and throttle. Fixed cost is about $0 (no hosted zone needed; custom domain, certificate and alias queries are free); about 7 CloudFormation resources per environment. Detailed per-route metrics (about $2/route/month) were the alternative.
- **No auth.** API keys and usage plans were considered and rejected (HTTP APIs have neither natively; an authorizer adds cost and nothing the simulation needs). `X-Requester` gives identity for analysis without authentication.
- **`requester` is never a CloudWatch dimension.** It's free-form and unauthenticated; each distinct value would be a billed custom metric anyone could create.
- **No custom metrics, metric filters or Logs Insights.** Built-in metrics for health; the warehouse for usage.
- **`/v1/feature-requests`, not `/v1/contacts`.** The public API hides the internal model; this is also the first worked example of the layering in §2.3. Every public controller routes through `publicApiService`, even as a pass-through, to keep one funnel.
- **Search over Order and Location, not Request.** Both are key lookups; the public object stays on BoroughSim's own order and location data. The three Request-only fields are deferred.
- **Spec hand-maintained, not generated from zod**, and served by the API itself so the web-app never reads a file from `backend/`.
- **Idempotency through a `CRID#` pointer row in a transaction.** A GSI on `client_request_id` was rejected: GSIs are eventually consistent, so two concurrent retries could both create.
- **Idempotency key as a header**, optional, mapped to `client_request_id`; keys are global and bodies are not compared in v1.
- **Tools deterministic, model chooses.** Inputs come from data wherever possible (the search's order, an anchored feature request) so that the model's role is the personality-driven choice and the resident's own wording, nothing else.
- **Step rows plus a `resolution` summary**, replacing `13-customer-simulation.md` §2 decision 7's `actions[]` on the idea row: an array rewrites the whole row per step, can't hold model turns well, and grows toward the 400 KB item limit.
- **Shared-prefix keys (`IDEA#<id>#STEP#n`)** over a separate `STEP#<id>#n` prefix: the most frequent read (an idea with its workstream) becomes one query instead of a `GetItem` plus a query. The cost is moving A3 to a sparse `ByResident` index, since a `begins_with(sk, "IDEA#")` listing would otherwise return steps and a filter can't fix page sizes.
- **The idea's `status` retired** for `resolution.status`, avoiding two overlapping lifecycles.
- **Tool and bucket renames.** The earlier `REQUEST_FEATURE`, `CHECK_STATUS_API`, `CONTACT` and `STATUS_API` predate the public API; no idea had an action, so nothing migrates.
- **Deferred by choice:** live refetch, the usage section, outcome counters, the DLQ alarm (cost), the feature-request form and Contacts tab.
