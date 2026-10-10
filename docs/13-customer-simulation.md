# The Customer — Simulated Support-Seekers + Bureau Lifecycle Webhooks

> **Status (2026-10-11): the bureau-side webhook is built (Appendix H);
> the customer side is not started.** `customer/` is still locked: its
> `CLAUDE.md` structure sections are proposed in Appendix F, not approved.
> Everything below this line is the 2026-10-05 capture as amended by the
> 2026-10-10 webhook review.
>
> **Original status (2026-10-05): capture draft — nothing built, nothing final.**
> Spec for [#58](https://github.com/seththeeke/nyc-311/issues/58), reshaped
> in-session. This version is a **capture of intent**, restructured into six
> sections that will each be worked through one at a time, with deliberate
> thought, in later sessions. No build starts until all six are reviewed.
>
> How to read it: each section has **Captured so far** (what has been said or
> proposed) and **To go deep on** (the questions that section's review must
> answer). "Captured" is not "agreed" unless the Decision Log in the Appendix
> says so. `customer/` stays locked until `CLAUDE.md` gains the sections
> proposed in Appendix F (§1.1 Directory Lock).

| # | Section | Review status |
|---|---|---|
| 1 | [Problem Statement](#1-problem-statement) | Considered sufficient |
| 2 | [Data Model](#2-data-model) | Bureau side (`WebhookSubscription`) agreed 2026-10-10 and **built**; customer side not reviewed |
| 3 | [Interaction Model](#3-interaction-model) | Not reviewed |
| 4 | [UX Design](#4-ux-design) | Not reviewed |
| 5 | [BoroughSim Webhook Design](#5-boroughsim-webhook-design) | Design decisions (items 5–15) agreed 2026-10-10 and **built 2026-10-11** (Appendix H); foundations (items 1–4) not walked through |
| 6 | [Isolation](#6-isolation) | Not reviewed |

---

## 1. Problem Statement

BoroughSim models only the supply side today: ingestion → orders → crews.
Real field-service businesses live or die on customer interaction, and
nothing in the system currently *wants* anything from it.

**The Customer** is an autonomous, simulated demand side: a small roster of
LLM-driven personas that behave like real New Yorkers following their 311
complaints. Each persona has a personality, a custom prompt and an activity
level, and on a believable, irregular cadence it has an **Idea** — *"I need
something"* — about an order the bureau has accepted, or about the service
itself ("I wish it would text me when the crew is on the way").

Phase 1 produces and logs Ideas, and makes the customers and their ideas
visible. Nothing acts on an idea yet. Later, a persona *actions* an idea
through some channel — a phone call, a text, driving the website, an MCP
server — and **that pressure is what drives which support capabilities the
bureau has to grow**. The customer is the source of product ideas; the bureau
evolves to meet them.

Constraints that shape everything below:

- **A real outsider.** The customer exists once, against **Prod only**, and
  reaches the bureau only the way a real user could. Changes to the bureau
  are tested in Test; the customer is where the ideas for them come from.
- **Pure isolation.** Own backend package, own infrastructure directory,
  own data. Enforced by lint and tests, not by convention (§6).
- **Pluggable.** Anchor source, idea planning, idea generation, recruiting
  and the Idea → action hand-off are separate components.
- **Phase 1 scope:** 1–3 personas; the bureau webhook; idea generation and
  storage; a public read API and a feature-flagged UI. No actioning, no
  answering, no conversations.

---

## 2. Data Model

### Captured so far

**Entities**

| Entity | Owner | Purpose |
|---|---|---|
| `WebhookSubscription` | Bureau | Who gets which events, at what URL, signed with what secret |
| Customer / Persona | Customer | The roster: identity, backstory, prompt, dials |
| `AcceptedOrder` | Customer | The customer's own copy of public metadata for orders the bureau accepted |
| `Idea` | Customer | One "I need something", logged `OPEN` |

Proposed persona shape (roster and draft prompts in Appendix B):

```ts
type Persona = {
  persona_id: string;           /* the codename, lowercased */
  version: number;              /* bump on any edit; stamped on every idea */
  name: string;
  backstory: string;
  persona_prompt: string;
  demeanor: { patience: number; hostility: number; verbosity: number };  /* 0-100 */
  activity_level: number;       /* 0-100, per-tick chance of having an idea */
  active_hours: { start: number; end: number };   /* America/New_York */
  follow_up_propensity: number; /* 0-100, return to a known order vs. a new one */
  idea_type_weights: Record<IdeaType, number>;
  interests: { boroughs: string[]; complaint_types: string[] };
  status: "ACTIVE" | "PAUSED";
};
```

Idea fields so far: `idea_id`, `persona_id`, `persona_version`, `idea_type`
(`STATUS_CHECK`, `SERVICED_CHECK`, `ETA_REQUEST`, `PRIORITY_INQUIRY`,
`ESCALATION`, `FEATURE_REQUEST`), `text`, optional anchor (`order_id`,
`external_unique_key`), `status` (`OPEN` only in phase 1), `created_at`,
`model_id`, `prompt_version`, token counts.

**Access patterns identified so far**

| # | Pattern | Caller | First thought |
|---|---|---|---|
| A1 | List customers (paginated) | UI list page | Roster is tiny now; must not rely on that |
| A2 | Get one customer | UI detail page, idea worker | Key lookup |
| A3 | List a customer's ideas, newest first, paginated | UI detail page | Make `persona_id` + time the **table key**, not a GSI |
| A4 | Get one idea | UI, future actioner | Needs a design if A3 owns the key |
| A5 | A customer's prior ideas about one order | Planner, generator | Sort-key or secondary index design |
| A6 | Orders a customer has already had ideas about | Planner (follow-up choice) | Derived from A5, or its own item |
| A7 | Pick a *fresh* accepted order weighted by interests | Planner | **Hardest one** — a random pick must not be a table scan |
| A8 | `OPEN` ideas, oldest first | Future actioner | Sparse index |
| A9 | Upsert an accepted order idempotently | Webhook listener | Conditional put on the event id |
| A10 | Active subscriptions for an event type | Bureau dispatcher | Tiny today |
| A11 | Per-customer idea count / last-idea time | UI list page | Counter maintained on write, never counted on read |

### Agreed — bureau side: `WebhookSubscription` (2026-10-10)

Reviewed question by question; resolves "To go deep on" item 9 below. The
customer is realistically the only subscriber, so every choice leans
minimal and is additive later.

| # | Question | Decision |
|---|---|---|
| 1 | What one row represents | One row per endpoint: one `callback_url`, one secret, one status, an explicit `event_types` list. No wildcard. |
| 2 | Key design and A10 | Table `WebhookSubscriptions-{Test,Prod}`, PK `subscription_id` (ULID), no sort key, no GSI, plain `Dao`. The dispatcher does a Scan and filters in code; a hard cap on subscription count, enforced at create, keeps the scan bounded (same precedent as `FeatureFlagDao.listFlags`). Create returns the existing subscription when the `callback_url` is already registered. |
| 3 | Status lifecycle | `ACTIVE` / `PAUSED`, both manual. Hard delete. The system never disables a subscription itself; a failing endpoint retries, dead-letters and alarms. |
| 4 | Signing secret | SSM Parameter Store SecureString; the row stores only `secret_parameter_name`. The subscriber supplies the secret at registration, so re-registration is idempotent and doubles as rotation. The registration controller redacts the secret from its request/response logging. |
| 5 | Ownership | A required `name` label only. No owner entity, and no `created_by`: registration uses one shared API key, so there is no distinct caller to record. |
| 6 | Mutability | `subscription_id`, `created_at`, `callback_url`, `secret_parameter_name` immutable. Re-registration overwrites `name`, `event_types` and the secret value, and never touches `status`. Writes are a full put conditioned on `version`. |
| 7 | Delivery attempts | Not an entity. One structured log line per attempt, plus the DLQ and SQS redrive. Revisit with §5 item 11. |

Stored row:

```json
{
  "subscription_id": "01K74Q8ZJ6M3T9X2R5VYB1C0DE",
  "name": "the-customer",
  "callback_url": "https://customer-api.boroughsim.com/webhooks/bureau",
  "event_types": ["ORDER_ACCEPTED", "ORDER_RESOLVED"],
  "status": "ACTIVE",
  "secret_parameter_name": "/nyc311/prod/webhook/01K74Q8ZJ6M3T9X2R5VYB1C0DE/secret",
  "version": 1,
  "created_at": "2026-10-10T14:03:11.000Z",
  "updated_at": "2026-10-10T14:03:11.000Z"
}
```

Still open from this review: the callback host is illustrative (§4 item
11).

### To go deep on

1. **Customer vs. Persona.** One entity or two? A Customer with a current
   Persona plus a version history would let an idea point at the exact
   prompt that produced it — is that worth the second entity?
2. **Key design per table**, written out as PK/SK/GSI with every access
   pattern above mapped to exactly one query — no scans, no filters on
   large result sets.
3. **A7 at scale.** How to sample a random accepted order matching a
   persona's interests in bounded reads (bucketed partitions with a random
   sort key? a per-persona candidate list filled at webhook time?).
4. **TTL vs. references.** Accepted orders expire; ideas don't. Does an idea
   carry a snapshot of its anchor so the UI still renders after expiry?
5. **Pagination contract** for the public API: opaque cursors, page-size
   caps, and what "newest first" means under concurrent writes.
6. **Growth model.** Ideas per persona per day × personas × retention —
   what are the real numbers at 3, 10 and 100 personas, and where does the
   first thing break?
7. **Mutability.** Which fields are immutable once written (idea text?
   persona version?) and what is append-only.
8. **Reserved-for-later fields** (action, response, conversation) — reserve
   them now, or leave them out entirely until that phase designs them?
9. **Bureau side:** `WebhookSubscription` shape, where the signing secret
   lives, whether a delivery-attempt log is its own entity, and the
   `data-model.md` / `dao/` placement.
10. **Naming.** Is "Idea" the right word (vs. Need, Intent)? Prod-only
    table names without an env suffix?

---

## 3. Interaction Model

### Captured so far

Three flows, end to end:

**Flow A — an accepted or resolved order reaches the customer**

```
[bureau] Orders table stream -> orders fan-out Lambda -> Nyc311OrderEvents SNS topic   (all exist)
[bureau] -> dispatch queue, filter {event_type: [ORDER_ACCEPTED, ORDER_RESOLVED]}   (3 attempts -> DLQ + alarm)
[bureau] -> dispatch Lambda: build the public payload (Order + its Request's own 311 record), one message per ACTIVE subscription
[bureau] -> delivery queue -> delivery Lambda (max concurrency 2): re-read subscription, sign, HTTPS POST
            failure -> retried every 30 min, 48 attempts (~1 day) -> DLQ + alarm
 ~~~~~~~~~~~~~~~~~~~~~~~ public internet ~~~~~~~~~~~~~~~~~~~~~~~
[customer] HTTP API -> receiveWebhookController: verify signature, dedupe, open or close the order
```

**Flow B — a persona has an idea**

```
[customer] EventBridge Scheduler, hourly -> tickController
             per ACTIVE persona inside active_hours: roll activity_level, check caps
             on a hit: create a one-time schedule at now + random(0-60 min)
[customer] -> ideaWorkerController
             IdeaPlanner (code): choose anchor (follow-up vs fresh) and idea type
             IdeaGenerator (Bedrock, Converse API): the need, in the persona's voice
             write Idea (OPEN), update persona counters
```

**Flow C — someone looks at it**

```
browser -> customer-api.boroughsim.com -> read controllers -> customer tables
```

Points already settled or proposed:

- Hourly tick. The random offset uses a one-time EventBridge Scheduler
  schedule because SQS delay caps at 15 minutes.
- Planning is deterministic code; only the wording comes from the model.
- The idea is *what they want and why*, not a message for any channel.
- Cheapest Bedrock text model; every idea records model, prompt version and
  token counts so an upgrade can be judged on data.
- Global kill switch and daily caps, since this runs only in Prod.
- Pluggable components: `AnchorSource`, `IdeaPlanner`, `IdeaGenerator`,
  `Recruiter` (no-op), and the Ideas table as the hand-off to a future
  actioner.

### To go deep on

1. **Every hop's failure mode**, one by one: what retries, what is dropped,
   what alarms, what is idempotent. A full table per flow.
2. **Self-registration lifecycle**: when it runs (deploy-time trigger?
   self-healing on tick?), what happens if the bureau is down, how the
   secret is stored and rotated. Depends on §5's registration decision.
3. **The tick in detail**: roll semantics, the active-hours curve (flat
   window vs. a time-of-day shape), per-persona and global caps, what
   happens to a hit when there are no accepted orders yet.
4. **One-time schedules**: naming, cleanup, quotas, and what the worker
   does if the persona was paused between tick and fire.
5. **Planner rules**, precisely: follow-up vs. fresh, how history shifts
   type weights toward `ESCALATION`, when `FEATURE_REQUEST` fires and
   whether it needs an anchor.
6. **Prompt assembly**: system vs. user content, how much history, the
   hand-written "what the site offers today" context for feature requests
   and who keeps it current, prompt versioning.
7. **Model output handling**: length limits, refusals, empty or off-persona
   output, a "nothing to say" escape, retries vs. skip.
8. **Bedrock specifics**: confirm the cheapest model against the pricing
   page, account model access, throttling, cost per idea.
9. **Infrastructure inventory**: every Lambda, queue, schedule, table, API,
   alarm and IAM grant, named, per side.
10. **Observability**: structured log events, metrics and alarms per flow,
    and how to answer "why did Hawthorn not have an idea today?".
11. **Ordering and duplicates**: at-least-once delivery, out-of-order
    events once more event types exist.

---

## 4. UX Design

### Captured so far

- **A public Customers area** in the existing web-app, as a new sidebar
  entry directly **under Map**.
- **List page** — every customer with their information: name, backstory,
  prompt, personality dials, activity.
- **Detail page** — click a customer to get a dedicated page of their
  ideas; a page meant to be built on further.
- **Secondary workspace** — the Customers pages fill the right-hand panel
  with their own content. This is the **first** route to drive the
  secondary workspace itself; today its content is static
  (`12-UX-workspace-refactor.md` decision 3).
- **Behind a feature flag**, so it can be built incrementally without
  breaking anything already live.
- **Its own API**: the customer stack exposes
  `customer-api.boroughsim.com` with endpoints that surface customers,
  their personas and their ideas.

Relevant existing pieces: `components/shell/menuConfig.ts` (data-driven
menu; Map is a `LINK` entry), the widget registry and `TILE`/`PANEL`/`FULL`
sizes, the bureau's feature-flag system with treatments, and `web-app`'s
mandatory in-memory mode (§5.1).

Sketch of the API surface: `GET /customers`, `GET /customers/{id}`,
`GET /customers/{id}/ideas` — all public, read-only, paginated.

### To go deep on

1. **Mockups first.** How to mock: static frames under `ux/`, or build
   straight against in-memory mode, which §5.1 requires anyway and gives a
   clickable prototype for free?
2. **Feature flag mechanics.** The flag system is backend-evaluated and the
   web-app has no public client-side treatment lookup today. What does the
   UI ask, of which API, and what does `OFF` hide — the menu entry, the
   routes, both? Flag key and treatments. Default `OFF` until when?
3. **Where the flag lives.** The flag is bureau state gating a view of
   customer data — acceptable, or an isolation wrinkle (§6)?
4. **Which environment shows what.** The customer exists only in Prod.
   Does `test.boroughsim.com` show Prod customers, mock data, or nothing?
5. **Secondary workspace contract.** How a route declares its own secondary
   content, what the list page puts there vs. the detail page, and what
   happens on routes that don't declare any.
6. **List page design**: card vs. table, how a long prompt is shown, how
   the 0–100 dials are visualised, empty/loading/error states.
7. **Detail page design**: idea timeline, grouping by anchor order, filters
   by type, pagination or infinite scroll, deep links to one idea.
8. **"Evolve further."** Read-only for now — or is there an intent to act
   on ideas from this page later (which would mean auth and writes)?
9. **Is the prompt public?** Showing `persona_prompt` verbatim on a public
   page — fine for fictional personas, but confirm.
10. **web-app structure**: models + zod schemas, service (live + mock),
    TanStack Query hooks, a second API base URL in `config.ts`, routes,
    test-data, accessibility, the 200-line component rule.
11. **Domain & CORS**: certificate and DNS for `customer-api.boroughsim.com`,
    allowed origins, and whether the webhook listener shares this host or
    gets its own.

---

## 5. BoroughSim Webhook Design

This section doubles as a learning track: its review should start from
first principles and end with a design.

### Captured so far

- **The public interface is HTTPS, not SNS.** A subscriber sees a
  registration API and signed `POST`s to its callback URL. SNS is internal
  plumbing it never touches.
- **A separate public contract.** Public event names are `ALL_CAPS`, per
  `CLAUDE.md` §6 (decided 2026-10-10, for consistency; no carve-out). The
  public `ORDER_ACCEPTED` shares its name with the internal event type but
  is its own list and its own payload schema, mapped in the dispatcher, so
  an internal rename or payload change does not reach subscribers.
- **Accepted means accepted.** Fired only when the bureau has committed to
  service the order; orders later rejected never appear.
- **Public-safe payload, no SLA and no priority** — the customer doesn't
  know them, which is exactly why a persona asks.
- **At-least-once delivery** with an idempotency key; dispatch and delivery
  split so one slow subscriber never delays another.
- **Wire format:** [Standard Webhooks](https://www.standardwebhooks.com/),
  HMAC variant (agreed 2026-10-10).
- **Lives in the bureau**, in Test and Prod, as an ordinary feature under
  the existing `CLAUDE.md` structure: no `cdk/webhook/` folder (queues and
  Lambdas in `cdk/lambda/`, tables in `cdk/data/`, routes in `cdk/api/`).
  One consumer today, but shaped like a production webhook sender.
- **Every design decision from the 2026-10-10 review is in the Decision
  Log (Appendix A)**: registration auth and key, API surface, URL
  validation, signing, payloads, delivery path, retries, operability,
  limits, launch catalogue, testing and code placement.

Payload (agreed 2026-10-10) — a fat event, so the customer never calls the
bureau back. The dispatch Lambda builds it from the Order and its Request.
`borough`, `address` and `zip` come from the Request's own 311 record, not
the Location row (as built — see Appendix H), and are nullable. Versioning is additive-only:
receivers ignore unknown fields, and a breaking change gets a new event
name. `webhook-id` is `evt_<order_id>_<sequence_number>`. Excluded on
purpose: SLA deadline, priority tier, assigned operator, internal stage,
costs, `location_id`, latitude and longitude.

```json
{
  "type": "ORDER_ACCEPTED",
  "timestamp": "2026-10-10T14:03:11.000Z",
  "data": {
    "order_id": "01K74PZ3W8N5H2Q7D4GJX6T9RA",
    "request_id": "01K74PYV1C8M6B3F9S2KQ7W4ZE",
    "external_unique_key": "69860415",
    "complaint_type": "Street Condition",
    "descriptor": "Pothole",
    "borough": "BROOKLYN",
    "address": "412 ATLANTIC AVENUE",
    "zip": "11217",
    "reported_at": "2026-10-09T22:41:00.000Z",
    "accepted_at": "2026-10-10T14:03:11.000Z"
  }
}
```

### To go deep on

**Foundations (learn)**

1. What a webhook is, and when to choose it over polling, a pub/sub
   subscription, or a streaming API.
2. The vocabulary: event, subscription (endpoint), delivery attempt,
   message id — and how they relate.
3. How established providers do it — Stripe, GitHub, Shopify, Svix — and
   what they agree on.
4. The standards: Standard Webhooks and CloudEvents — what each
   standardises and whether to adopt one, both or neither.

**Design decisions**

5. **Registration auth — decided 2026-10-10: an issued API key.** Public
   self-registration with a handshake and admin-gated registration were
   both rejected. Still to settle: where the key is checked and stored, and
   what callback-URL validation remains once only a key holder can
   register.
6. **Endpoint verification**: challenge/echo handshakes and why they exist.
7. **Signing**: HMAC vs. asymmetric signatures, what is signed, replay
   windows, constant-time comparison, secret rotation with overlap.
8. **Delivery semantics**: at-least-once, no ordering guarantee, and what
   that obliges the receiver to do.
9. **Retry policy**: schedule and backoff, timeouts, which status codes
   retry, dead-lettering, auto-disabling a failing endpoint.
10. **Payload design**: fat vs. thin events (send the data, or send an id to
    fetch), versioning strategy, what "public-safe" means field by field.
11. **Operability**: delivery log, manual redelivery/replay, a test-event
    endpoint, subscriber-visible status.
12. **AWS implementation choices**: the custom SNS → SQS → Lambda path vs.
    EventBridge API Destinations, and why.
13. **Event catalogue roadmap** — decided 2026-10-10: launch with
    `ORDER_ACCEPTED` and `ORDER_RESOLVED`; `ORDER_SCHEDULED`,
    `ORDER_DISPATCHED`, `ORDER_ARRIVED` and `CASE_CREATED` follow when
    ideas ask for them.
14. **Limits and abuse**: subscription caps, rate limits, payload size.
15. **Testing it**: how an integration test receives a callback when a
    CodeBuild step can't accept inbound HTTP.

---

## 6. Isolation

### Captured so far

**Layout**

```
customer/backend/   own npm package; copies logger/DAO base/errors, imports nothing from backend/
cdk/customer/       ALL customer infrastructure, nothing else
```

**Lint rules (errors, both directions)**

| Where | Bans |
|---|---|
| `backend/**` | importing anything under `customer/` |
| `customer/backend/**` | importing anything outside its own package |
| `cdk/**` outside `cdk/customer/` | importing `cdk/customer/**`; any string literal with a `customer` path segment |
| `cdk/customer/**` | importing bureau construct directories; any string literal with a `backend` path segment |

The string-literal rule (a custom `local/customer-boundary`) exists because
Lambda entry points are path strings, not imports — an import ban alone
would never catch a bureau construct pointing at `customer/backend`.
Sanctioned exceptions are single files with explicit overrides:
`cdk/customer/customerBackendRoot.ts`, and the stage/app entrypoints that
instantiate the customer stack.

**Runtime isolation**

- One `Nyc311CustomerStack`, Prod only, no cross-stack references —
  asserted by a template test (no `Fn::ImportValue`, no bureau ARN).
- IAM: customer Lambdas reach only their own resources plus Bedrock.
- The customer reaches the bureau only through public URLs.

**Known shared surfaces (to be judged, not hidden)**

| Shared thing | Why it exists |
|---|---|
| The `cdk/` package and its `node_modules` | Decision: one infra package, separate directory |
| The pipeline | One CD pipeline; a failing customer test blocks bureau deploys |
| The AWS account and region | Same account as the bureau |
| The `boroughsim.com` hosted zone | `customer-api.boroughsim.com` |
| The web-app | The bureau's UI renders customer data by calling the customer API |
| The feature flag | Bureau flag state gates the customer UI |

### To go deep on

1. **Define "isolated" precisely.** Code? Data? IAM? Network? Deployment?
   Failure blast radius? Which of these are absolute and which are
   best-effort — and write that down as the standard.
2. **Judge each shared surface** above: accept, mitigate or remove. The
   web-app calling the customer API and the feature flag are the two new
   ones introduced by the UI scope.
3. **The verification suite.** For every isolation claim, the mechanism
   that proves it: lint rule, lint-rule fixture test, template assertion,
   IAM policy assertion, dependency-graph check.
4. **Making it permanent.** How the rules resist erosion: fixture tests
   that fail if a rule is weakened, `CLAUDE.md` wording, agent guard
   hooks, CI. What stops a future change from quietly adding an exception?
5. **The lint rules in detail**: exact patterns, false positives (the word
   "customer" in an unrelated string), the allowlist of shared `cdk/`
   helpers `cdk/customer/` may import, and test-file coverage.
6. **Does the web-app need a boundary rule too** — e.g. customer API calls
   confined to one service module?
7. **Copy vs. share.** Duplicated logger/DAO base/ESLint config will drift.
   Accept the drift, or is there any sanctioned shared layer?
8. **Deployment isolation.** The customer deploys with the bureau's Prod
   stage; should a customer failure be able to block or roll back a bureau
   deploy, and vice versa?
9. **Prod-only consequences.** No Test soak for customer code; kill switch
   and caps as the safety net; what a safe rollout of a customer change
   looks like.
10. **Naming carve-out.** Prod-only resources without an env suffix — a
    deliberate exception to `CLAUDE.md` §5.3 or keep `-Prod` for uniformity?

---

## Appendix

Material that doesn't belong to a section's review yet, kept so nothing is
lost.

### A. Decision log

| Topic | State |
|---|---|
| `customer/backend/` package; infra in `cdk/customer/` within the shared `cdk/` package | Agreed |
| Boundary enforced by lint rules, both directions | Agreed |
| Customer exists once, against Prod only | Agreed |
| Anchors come from a bureau webhook the customer registers with; webhook built first | Agreed |
| "Accepted" = `ORDER_ACCEPTED`; payload has no SLA or priority | Agreed |
| Phase 1 output is **Ideas**; actioning through a channel is a later phase | Agreed |
| Hourly tick | Agreed |
| Cheapest Bedrock text model; measure before upgrading | Agreed |
| Tree codenames; three personalities; prompts drafted by Claude | Agreed |
| Conversations deferred to the Case-based interaction model | Agreed (TBD by design) |
| Public customer API at `customer-api.boroughsim.com`; list + detail pages under Map, using the secondary workspace, behind a feature flag | Captured 2026-10-05, design pending (§4) |
| `WebhookSubscription` data model (§2, seven decisions) | Agreed 2026-10-10 |
| CDK placement: no `cdk/webhook/` folder. Webhook queues, DLQs and Lambdas go in `cdk/lambda/`, tables in `cdk/data/`, routes in `cdk/api/`, all in the single `Nyc311Stack`; the sink constructs exist only in Test. `cdk/customer/` is unaffected | Agreed 2026-10-10 |
| Backend placement: the webhook is an ordinary bureau feature under the existing `CLAUDE.md` rules — HTTP controllers in `controller/web-api/`, queue-triggered controllers in a new `controller/webhook/`, `service/webhook/`, per-entity DAO folders (no carve-out). Applied to `CLAUDE.md` §5.2 on 2026-10-11 | Agreed 2026-10-10 |
| `ORDER_RESOLVED` payload: the same order fields as `ORDER_ACCEPTED` plus `resolved_at` — one shared shape and one payload builder; no cost, cost model or crew identity. Receivers must tolerate a resolve arriving before its accept and must not reopen a closed order | Agreed 2026-10-10 |
| Launch event catalogue: `ORDER_ACCEPTED` and `ORDER_RESOLVED` (the internal name; the earlier "order completed" wording is dropped). The feed's job is to tell the customer which orders are **in play** — open on accept, closed on resolve — and nothing more. Later events (`ORDER_SCHEDULED`, `ORDER_DISPATCHED`, `ORDER_ARRIVED`, `CASE_CREATED`) are added when ideas ask for them | Agreed 2026-10-10 |
| Limits: registration route throttled to 1 rps / burst 5 via `ROUTE_THROTTLES`; request field limits (`name` ≤ 64, `callback_url` ≤ 2,048, `event_types` 1–10 known names, `secret` 32–128 characters); no payload size cap; delivery Lambda trigger `maxConcurrency` 2 so a backlog cannot flood a subscriber | Agreed 2026-10-10 |
| Operability: manual replay of an order's event is in scope; no "zero deliveries" alarm (not critical path, not worth the alarm cost) and no test-event endpoint. The two DLQ alarms stay | Agreed 2026-10-10 |
| Replay mechanism: an operational script under `test-scripts/` that takes order ids and puts the order's stored public-catalogue event (`ORDER_ACCEPTED` or `ORDER_RESOLVED`) back on the dispatch queue (dry run by default, `--execute` to send, `nyc311` profile, Deploy Safety Gate applies). Same `webhook-id`, so replay is idempotent for receivers. No admin route; no time-range replay | Agreed 2026-10-10 |
| End-to-end testing: a Test-only sink subscriber (receiver that verifies the signature and writes a TTL'd delivery record, plus a public `GET` of recent deliveries); the existing integration suite asserts a signature-valid delivery within the last 24 hours. No deterministic injected-event test | Agreed 2026-10-10 |
| Webhook defaults: subscription cap 25; dispatch queue 3 attempts then its own DLQ and alarm; delivery Lambda re-reads the subscription per attempt and drops the message if paused or deleted; Test allowlist = the sink's host, Prod allowlist = the customer listener's host; the sink is registered once by hand through the registration API | Agreed 2026-10-10 |
| Public event names are `ALL_CAPS` (`ORDER_ACCEPTED`), consistent with `CLAUDE.md` §6; lowercase dotted names with a §6 carve-out were rejected | Agreed 2026-10-10 |
| Dispatch and delivery stay split (two Lambdas, two queues, two DLQs) as captured in §3 Flow A, even with one subscriber: per-subscriber retries and dead-lettering, payload built once at dispatch. A single-Lambda design was considered and rejected in favour of the more production-realistic shape | Agreed 2026-10-10 |
| Delivery path: the custom SNS → SQS → Lambda path, not EventBridge API Destinations (which cannot HMAC-sign each request body) | Agreed 2026-10-10 |
| Retry policy, configuration only: success is any `2xx` within a 10-second timeout, anything else throws; delivery queue visibility timeout 30 minutes, `maxReceiveCount` 48 (about a day), then DLQ with an alarm on non-empty and SQS redrive. No retry code, no exponential backoff | Agreed 2026-10-10 |
| `ORDER_ACCEPTED` payload: fat event with `address` and `zip` added; additive-only versioning; `webhook-id` = `evt_<order_id>_<sequence_number>` (§5) | Agreed 2026-10-10 |
| Callback URL validation: must parse, be `https://`, stay under a length cap, and have a hostname on a per-environment allowlist. No address-range checks (the bureau has no VPC). The delivery Lambda does not follow redirects | Agreed 2026-10-10 |
| Subscription API surface: one route, `POST /webhook-subscriptions`, key-authenticated; creates, or overwrites `name`/`event_types`/secret for a known URL, and returns the row with its `status`. Pause, resume and delete are hand edits from a runbook (delete must also remove the SSM secret parameter). No admin routes, no UI | Agreed 2026-10-10 |
| Webhook registration auth: an issued API key, sent by the customer on every registration call. No public self-registration, no verification handshake | Agreed 2026-10-10 |
| Registration key mechanics: one key per environment in an SSM SecureString, created by hand once (CloudFormation cannot create SecureStrings) and copied to the customer's own store; checked in the registration service with a constant-time comparison, no Lambda authorizer; `created_by` dropped from `WebhookSubscription` | Agreed 2026-10-10 |
| Separate `Nyc311CustomerStack` | Proposed, follows from Prod-only |
| Standard Webhooks wire format, HMAC variant: `webhook-id`, `webhook-timestamp`, `webhook-signature` (`v1,` + base64 HMAC-SHA256 of `{id}.{timestamp}.{body}`), `whsec_` secrets, five-minute replay window. Sign and verify hand-written on each side with `node:crypto`; the `standardwebhooks` package is a test-only dependency used to cross-check | Agreed 2026-10-10 |

Superseded along the way: a UI was originally out of scope for phase 1; the
customer API was originally going to stay off the `boroughsim.com` domain.

### B. Launch roster (first-draft prompts)

| Codename | Who | Dials | Draft `persona_prompt` |
|---|---|---|---|
| **Sycamore** | Retired transit worker, 40 years on the same Queens block | patience 90, hostility 5, verbosity 70; activity 15; 07–19; follow-up 85 | "You are Sycamore, a retired transit worker who has lived on the same block in Queens for forty years. You are patient, polite and a little long-winded. You notice everything on your street and you follow one problem for weeks rather than chasing many. You trust the city to get to it eventually but you like to be kept informed, and you mention small neighbourly details." |
| **Hawthorn** | Owns a bakery in Brooklyn; deliveries depend on the street | patience 15, hostility 70, verbosity 35; activity 35; 05–18; follow-up 60 | "You are Hawthorn, who owns a bakery in Brooklyn. Broken streets cost you money: delivery vans, customers, your own time. You are blunt, impatient and businesslike, and you think in deadlines and dollars. You are not rude for sport, but you do not soften things, and when something drags you say so and want to know who is responsible." |
| **Juniper** | Night-shift hospital porter in the Bronx, commutes by bike | patience 50, hostility 20, verbosity 10; activity 20; 21–05; follow-up 40 | "You are Juniper, a night-shift hospital porter in the Bronx who cycles to work. You are tired, practical and terse — short sentences, no pleasantries. You care about hazards you hit in the dark. You are comfortable with technology and would rather have a tool or a notification than talk to anyone, so you often think about what the service should let you do yourself." |

Seeds would be one JSON file per persona in `customer/backend/personas/`,
zod-validated and synced at deploy.

### C. Inspiration from `agent-social`

Kept: versioned JSON seed per persona, free-text persona prompt, 0–100
frequency dials rolled per scheduler tick, the proactive/reactive split
(instigator → idea engine; processor → the later reaction phase).
Dropped: one queue per agent, module-scope clients, a manual upload script,
model-specific response parsing, and the absence of prompt versioning.

### D. Pipeline changes (full CD)

- Synth gains `cd customer/backend && npm ci && npm run lint && npm run test:coverage`.
- `Nyc311AppStage` instantiates the customer stack when `envName` is `PROD`.
- `DenyNyc311DirectDeploy` adds the customer stack ARN.
- Coverage rollup/publish scripts and `Nyc311CoveragePublishStep` learn the
  fourth package.
- The web-app build gains the customer API base URL.

### E. Tentative build order

To be re-cut after the six reviews; UI legs not yet placed.

1. Bureau webhooks (subscriptions, dispatch, delivery, signing, alarms).
2. Customer scaffold (package, empty stack, lint rules, pipeline wiring).
3. Listener + registration + accepted-orders copy.
4. Personas (model, seeds, sync).
5. Idea engine (planner, generator, ideas table), invoked by hand.
6. Cadence (tick, one-time schedules, caps, kill switch).
7. Customer read API + domain.
8. UI behind the feature flag (in-memory mode first).

### F. Proposed `CLAUDE.md` changes (for review, not applied)

- **§1** — add `customer/` as a fourth top-level working directory under
  the Directory Lock.
- **§5.1** — the Customers area: second API base URL, and whatever
  secondary-workspace contract §4 lands on.
- **§5.2** (agreed 2026-10-10, **applied 2026-10-11**; the webhook is an ordinary bureau feature
  and follows the existing rules, no new carve-outs) — add
  `controller/webhook/` for the two queue-triggered entry points (dispatch,
  deliver); the HTTP entry points (register subscription, sink receiver,
  sink `GET`) go in `controller/web-api/` like every other route; logic in
  `service/webhook/`; DAOs in per-entity folders `dao/webhookSubscription/`
  and `dao/webhookSinkDelivery/`, with both added to `data-model.md`.
- **§5.3** — add `cdk/customer/` (the bureau webhook needs no §5.3 change;
  it uses the existing `cdk/lambda/`, `cdk/data/`, `cdk/api/`); record
  `Nyc311CustomerStack` as a standing exception to the single-stack rule;
  state the boundary rules.
- **New §5.4 `customer/backend/`** — structure, "copy, never import from
  `backend/`", and the four standard commands.
- **§2 / §8** — Operational Loop and coverage rollup cover four packages.

**Proposed wording for the customer scaffold — awaiting approval
(2026-10-11).** Nothing under `customer/` or `cdk/customer/` may be written
until this is approved and added to `CLAUDE.md` (§1.1). Scoped to the next
milestone only: a listener that records webhook events.

*§1, top-level directories — add:*

> - `customer/` — the simulated customer (`13-customer-simulation.md`), a
>   real outsider to the bureau. Holds one package, `customer/backend/`.
>   Its infrastructure lives in `cdk/customer/`.

*New §5.4 `customer/backend/`:*

> Its own npm package with the same layering, rules and tooling as
> `backend/` (§5.2): controller → service → DAO, a zod schema at every
> trust boundary, lazily constructed clients, logging by layer, camelCase
> files, ESLint with `no-explicit-any` and `local/comment-format`,
> Vitest with a 90% per-file coverage gate, and the same four commands
> (`build`, `lint`, `test`, `test:coverage`).
>
> **It imports nothing from outside `customer/backend/`**, and nothing in
> `backend/` imports from `customer/`. Shared helpers (`logger.ts`,
> `env.ts`, the `Dao` base, the error types) are copied, never imported.
> Both directions are enforced by `no-restricted-imports` in each
> package's `eslint.config.js`.
>
> ```
> customer/backend
>  -> logger.ts, env.ts - copied from backend/
>  -> controller
>   -> webhook - the HTTP listener the bureau POSTs lifecycle events to
>  -> service
>  -> dao - grouped by the entity stored
>   -> order - the customer's own record of an order in play
>  -> models
>  -> tests - mirrors the structure above
> ```

*§5.3 `cdk/` — add:*

> -> customer - ALL customer infrastructure and nothing else
>
> **Second standing exception to the single-stack rule:**
> `Nyc311CustomerStack` (under `cdk/customer/`), deployed to **Prod
> only**. No cross-stack references to `Nyc311Stack` in either direction;
> the customer reaches the bureau only through public URLs. `cdk/customer/`
> imports no bureau construct directory, and nothing outside it imports
> from it except the app/stage entrypoints that instantiate the stack.
> Prod-only resources keep the `-Prod` suffix.

*§2 / §8:* the Operational Loop and coverage rollup cover four packages.

Four decisions inside this milestone still need a call before building
(none has been reviewed): the stack and its Prod-only pipeline wiring
(§6); the listener's host and path (§4 item 11); the order table's shape
(§2); and whether registration is by hand for now (§3 item 2).

### G. Differences from #58

- Anchors come from a bureau webhook, not the SODA API.
- The output is Ideas, not `CustomerQuestions` with a stubbed channel.
- `FEATURE_REQUEST` is added to the taxonomy.
- 3 personas at launch, not 5–6. Prod only, not Test + Prod.
- Infra lives in `cdk/customer/`, not a separate CDK package.
- No per-persona conversation log.
- A public API and UI are now in scope.

### H. Build progress and runbook (bureau webhook)

**Built 2026-10-11** — leg 1 of the build order. Not deployed until the
commit is pushed and the pipeline runs.

| Piece | Where |
|---|---|
| Models | `backend/models/webhookSubscription.ts`, `webhookEvent.ts`, `webhookDeliveryTask.ts`, `webhookSinkDelivery.ts`; `UnauthorizedError` in `errors.ts` |
| DAOs | `backend/dao/webhookSubscription/`, `backend/dao/webhookSinkDelivery/` |
| Services | `backend/service/webhook/` — subscription (key check, URL allowlist, upsert), dispatch, delivery, sink, signing, SSM secret store |
| Controllers | `controller/web-api/`: register, sink receive, sink list. `controller/webhook/`: dispatch, deliver |
| Infrastructure | `cdk/data/WebhookSubscriptionsTable.ts`, `WebhookSinkDeliveriesTable.ts`; `cdk/lambda/Nyc311Webhook*.ts`, `Nyc311RegisterWebhookSubscriptionApiLambda.ts`, `webhookConfig.ts`; two DLQ alarms added to `Nyc311OrderPipelineAlarms`; three routes and one throttle in `cdk/api/Nyc311Api.ts` |
| Replay | `test-scripts/11-replay-webhook-events.js` |
| Integration check | `backend/tests/integration/webhookSinkApi.integration.test.ts` (Test target only) |
| Docs | `CLAUDE.md` §5.2, `data-model.md`, `ddb-design.md` |

**Where the build differs from the design above**

- **Address fields come from the Request, not the Location.** A Location
  is keyed by BBL and keeps the address of the first complaint ever filed
  there; the Request's `raw_payload` has this complaint's own
  `incident_address`, `incident_zip` and `borough`. More accurate, and one
  read fewer.
- **`reported_at` is the 311 record's `created_date` as published** — New
  York local time with no offset (e.g. `2026-10-09T22:41:00.000`), unlike
  the UTC `accepted_at` / `resolved_at`.
- **An `ORDER_RESOLVED` for an Order with no `ORDER_ACCEPTED` event is
  skipped**, since subscribers were never told it was in play.
- **The integration check tolerates an empty sink.** With no recorded
  deliveries it warns and passes, so an unregistered sink does not block
  `DeployProd`. Once deliveries exist it requires every one to be
  signature-valid and the newest to be under 24 hours old. Sink records
  expire after a week, so a path that stays broken for a week goes quiet
  again.
- **The registration key travels in the `x-api-key` header.**
- **Prod's callback allowlist is `customer-api.boroughsim.com`**, which
  assumes §4 item 11 lands on that host for the listener. Change
  `cdk/lambda/webhookConfig.ts` if it does not.
- **The sink's `GET` route is in the integration route report** and reads
  as "not hit" in a Prod report, because the sink exists only in Test.
- The new Lambdas are not on the Monitoring page's Lambda-health list.

**One-time manual steps, per environment** (all mutate real AWS resources
— CLAUDE.md §3 applies to each)

Test, after the first deploy:

```sh
# 1. The registration key
aws ssm put-parameter --profile nyc311 --type SecureString \
  --name /nyc311/test/webhook/registration-key --value "$(openssl rand -base64 32)"

# 2. The sink's signing secret
SINK_SECRET="whsec_$(openssl rand -base64 32)"
aws ssm put-parameter --profile nyc311 --type SecureString \
  --name /nyc311/test/webhook-sink/secret --value "$SINK_SECRET"

# 3. Register the sink as a subscriber
KEY=$(aws ssm get-parameter --profile nyc311 --with-decryption \
  --name /nyc311/test/webhook/registration-key --query Parameter.Value --output text)
curl -sS -X POST https://api.test.boroughsim.com/webhook-subscriptions \
  -H "content-type: application/json" -H "x-api-key: $KEY" \
  -d "{\"name\":\"test-sink\",\"callback_url\":\"https://api.test.boroughsim.com/webhook-sink\",\"event_types\":[\"ORDER_ACCEPTED\",\"ORDER_RESOLVED\"],\"secret\":\"$SINK_SECRET\"}"

# 4. After the next accepted Order: deliveries should appear, all signature_valid
curl -sS https://api.test.boroughsim.com/webhook-sink/deliveries
```

Prod: step 1 only, with `/nyc311/prod/webhook/registration-key`. The
customer registers itself (or is registered by hand the same way as step
3) once its listener exists.

**Operating it**

```sh
# Pause (use ACTIVE to resume). Bump version so a concurrent re-registration fails cleanly.
aws dynamodb update-item --profile nyc311 --table-name WebhookSubscriptions-Prod \
  --key '{"subscription_id":{"S":"<id>"}}' \
  --update-expression 'SET #s = :s, #v = #v + :one, updated_at = :now' \
  --expression-attribute-names '{"#s":"status","#v":"version"}' \
  --expression-attribute-values '{":s":{"S":"PAUSED"},":one":{"N":"1"},":now":{"S":"<ISO timestamp>"}}'

# Delete: the row, then its secret
aws dynamodb delete-item --profile nyc311 --table-name WebhookSubscriptions-Prod --key '{"subscription_id":{"S":"<id>"}}'
aws ssm delete-parameter --profile nyc311 --name /nyc311/prod/webhook/<id>/secret

# Redrive a DLQ back to its source queue
aws sqs start-message-move-task --profile nyc311 --source-arn <DLQ ARN>

# Replay specific Orders' events (dry run without --execute)
node test-scripts/11-replay-webhook-events.js --env prod --execute <order_id> [...]
```

Rotating the registration key is step 1 again with `--overwrite`, then
updating the customer's copy. Rotating a subscriber's signing secret is a
re-registration with the new secret.
