# Resident contact: the Contact entity and the `REQUEST_FEATURE` action

**Status (2026-10-31): design in progress, nothing built.** The Contact model in §2 was agreed on 2026-10-24, then paused behind the resource consolidation (`15-resource-consolidation.md`). That work is done: Test is at 317 of 500 resources and Prod at 312, so Contacts can resume. Items marked **[OPEN]** are not decided.

Tracking: [#110](https://github.com/seththeeke/nyc-311/issues/110) (Contacts) and [#111](https://github.com/seththeeke/nyc-311/issues/111) (resident actions, first `REQUEST_FEATURE`, depends on #110).

Build order, as agreed:

1. The Contact data model (§2). **Agreed.**
2. The basic infrastructure and API (§3–§4).
3. The request-feature component and the Contacts tab in the web-app (§5).
4. Only then, the resident `REQUEST_FEATURE` action (§6), designed in its own pass.

---

## 1. Background

`13-customer-simulation.md` decision 8 (agreed 2026-10-17) says feature intake is a BoroughSim website feature built on a new, generic **Contact** entity:

- A contact is someone reaching BoroughSim. `contact_type` says what kind; the first type is `FEATURE_REQUEST`.
- The web-app gets a feature-request component that creates a contact of that type.
- A resident's `REQUEST_FEATURE` tool submits through **the same public route** the component uses, so a resident reaches BoroughSim the way a person would.
- The returned `contact_id` is the action evidence's `reference_id` (`13-customer-simulation.md` §M).

## 2. The Contact model (agreed 2026-10-24)

### 2.1 Decisions

| # | Question | Decision |
|---|---|---|
| 1 | Contact vs Case | **Contact is a new concept.** Case stays as it is, a system-raised trouble ticket (`data-model.md` § Case); nothing in Case is renamed or removed. The two are not linked in this build. |
| 2 | Shape | `title` and `description` are **top-level** and shared by every `contact_type`. `contact_type` only classifies the contact; there's no per-type sub-object. |
| 3 | Who is calling | **No `user_agent`, IP or IP-hash fields.** The design is generic: residents will use it heavily, but so may real people. Residents are a simulation of users and are treated as any other submitter. Nothing in the row tells them apart. |
| 4 | Storage | **Plain row** on the plain `Dao<T>` base, not event-sourced. Status history can come later, with events, once triage creates real transitions. |
| 5 | Statuses | `RECEIVED` → `IN_PROGRESS` → `CLOSED`, plus `closure_reason_code` and `closure_reason_description` for the detail. Only `RECEIVED` is written in the first build. |
| 6 | Submitter | `submitter.name` is required; `submitter.email` is optional. |
| 7 | Idempotency | `client_request_id` is the idempotency key. A retry with the same key returns the original contact instead of creating a second one. |
| 8 | Visibility | **Contacts are not admin-only.** A public Contacts tab in the web-app shows a simple list for now, and `GET /contacts/{contact_id}` lets a resident (or anyone) check a contact's status later. |

### 2.2 The stored row (`Contacts-Test` / `Contacts-Prod`)

```json
{
  "contact_id": "01K8C4T1W7H3P9N2M6QZ8V0RJD",
  "contact_type": "FEATURE_REQUEST",
  "status": "RECEIVED",
  "title": "Text me when a repair near me is scheduled",
  "description": "I ride past these every night. Let me subscribe to a street and get a text when work is booked.",
  "submitter": {
    "name": "Hawthorn",
    "email": null
  },
  "closure_reason_code": null,
  "closure_reason_description": null,
  "client_request_id": "b6f0c1e2-7a4d-4c1e-9d55-2f0e8c3a9b11",
  "created_at": "2026-11-02T22:14:02.000Z",
  "updated_at": "2026-11-02T22:14:02.000Z"
}
```

- **Key:** partition key `contact_id`, a ULID like every other id here, so it sorts by creation time.
- **Enum values** are `ALL_CAPS` (CLAUDE.md §6): `contact_type` is `FEATURE_REQUEST`; `status` is `RECEIVED`, `IN_PROGRESS` or `CLOSED`.
- `closure_reason_code` and `closure_reason_description` are `null` until `CLOSED`.

**[OPEN]**
- **Closure reason codes.** Candidates: `IMPLEMENTED`, `DECLINED`, `DUPLICATE`, `NOT_ACTIONABLE`.
- **List index.** Earlier sketch: a `ByType` GSI (`by_type_pk` = `contact_type`, sorted by `contact_id`) for the newest-first list. The alternative is a scan, which is acceptable at this scale for the "brute force" list.
- **How the idempotency key is enforced.** Earlier sketch: a conditional put on a `CRID#<client_request_id>` pointer row in the same table, written in one transaction with the contact.
- **Whether `client_request_id` is required or optional.** The web component and the resident tool would both always send one.
- **Field limits.** Earlier sketch: title 5–120 characters, description 10–2000, name ≤ 80, email validated, body ≤ 8 KB.

## 3. API

Contacts is a new public **Service API bundle**, `controller/web-api/contacts/`, with one Lambda (`Nyc311ContactsApiLambda`). It isn't an admin route, so it never shares the admin bundle (`15-resource-consolidation.md` §3). Adding a new bundle is a design decision, recorded here.

| Route | Purpose |
|---|---|
| `POST /contacts` | Create a contact (the web component and the resident tool) |
| `GET /contacts` | The public list behind the Contacts tab |
| `GET /contacts/{contact_id}` | One contact's current state, so a submitter can check status |

**`POST /contacts` request:**

```json
{
  "contact_type": "FEATURE_REQUEST",
  "title": "Text me when a repair near me is scheduled",
  "description": "I ride past these every night. Let me subscribe to a street and get a text when work is booked.",
  "submitter": { "name": "Hawthorn", "email": null },
  "client_request_id": "b6f0c1e2-7a4d-4c1e-9d55-2f0e8c3a9b11"
}
```

**`201` response** (a retry with the same `client_request_id` gets the original back):

```json
{ "contact_id": "01K8C4T1W7H3P9N2M6QZ8V0RJD", "status": "RECEIVED", "created_at": "2026-11-02T22:14:02.000Z" }
```

**`GET /contacts/{contact_id}`** returns the row in §2.2, with the caveats below. An unknown id returns 404.

**[OPEN]**
- **Abuse limits for an unauthenticated write.** Candidates: a `ROUTE_THROTTLES` entry for `POST /contacts`, the zod size limits, and whether to add anything else, such as a captcha or WAF, later.
- **What the public reads expose.** A public list and lookup would show `submitter.email` and `client_request_id` to anyone. Proposal: public responses omit `email` and `client_request_id`, and `name` is shown as given.
- **Pagination of `GET /contacts`.** It starts as a brute-force list; a cursor would follow the existing page-cursor pattern.
- Whether an admin route for status changes (`IN_PROGRESS`, `CLOSED` with a reason) is in the first build or comes later.

## 4. Infrastructure and resource budget

The 2026-10-24 estimate, priced from existing pieces of the same kind:

| Piece | Resources |
|---|---|
| `Contacts` table (with GSI or pointer rows; neither adds resources) | 1 |
| API: one bundle Lambda (function, role, policy, log group, one integration, one permission) plus 3 routes | about 9 |
| Warehouse leg (stream fan-out Lambda with DLQ, SNS topic and policy, Firehose with roles and log group, Glue table) | about 18 |
| Alarms | 0–2 |
| **Total** | **about 10 without the warehouse leg, about 30 with it** |

At 317 resources (Test), either fits comfortably under 500.

- Every named resource gets the env suffix (CLAUDE.md §5.3), e.g. `Contacts-Test` and `Nyc311ContactsApi-Prod`, and log groups use `RemovalPolicy.DESTROY`.
- The bundle's routes come from `contactsApiRoutes.ts`, like every other bundle.

**[OPEN]** Whether the warehouse leg ships in the first build or later.

## 5. Web-app

- **Feature-request component.** A form with title, description, name and optional email. It generates a `client_request_id` per submission, so a double-click or retry doesn't file twice. On success it shows the `contact_id` and status.
- **Contacts tab.** A public page with a simple list (title, type, status, submitter name, created), linking to one contact's detail.
- **Layering** follows CLAUDE.md §5.1: `models/contact.ts` (type plus zod schema), `services/contactService.ts` with live and in-memory implementations, hooks on TanStack Query, and mock data in `test-data/`.

**[OPEN]** Where the feature-request component lives: its own route, a button on the Contacts tab, or both.

## 6. The resident action: `REQUEST_FEATURE` (first resident action)

This is the first action residents get. It is designed in full **after** §2–§5 are built. What is already agreed in `13-customer-simulation.md` (§2 decision 7, §3 Flow B decisions 5, 7 and 8, §L, §M):

- **Actions are tools granted in buckets.** The first bucket holds `REQUEST_FEATURE`. A resident carries `action_buckets` and `action_weights`, both frozen into each `V#` version row. Today every resident has `action_buckets: []` and `REQUEST_FEATURE: 0`.
- **The loop is async.** After writing an idea, the idea worker enqueues `{ persona_id, idea_id }` on an `IdeaActions` queue (with a DLQ). A separate action worker runs one Bedrock Converse conversation: the resident's prompt, the idea, and the granted tools.
- **Tools are fixed recipes.** `REQUEST_FEATURE` is an **API** recipe: the model only chooses to call it and supplies its declared inputs (`title`, `description`). The recipe does the rest:
  1. It sets `submitter.name` to the resident's name and `submitter.email` to `null`.
  2. It generates a `client_request_id` and sends `POST /contacts` to BoroughSim's public URL, exactly as the web component does.
  3. It returns the response to the model.
- **Each call is recorded** as one entry in the idea's `actions[]`. A failure is recorded `FAILED` and returned to the model, which may stop or try another tool. There's no retry machinery beyond the queue.
- **Caps:** each tool declares a maximum number of invocations per idea, plus a maximum number of actions per idea. Weights are offered as a preference in the system prompt. The queue trigger has a `maxConcurrency`.
- **The boundary holds** (CLAUDE.md §5.3, §5.4). The customer reaches BoroughSim only through the public URL. It imports no BoroughSim code and copies the Contact request shape into its own models.

The action entry on the idea row (`13-customer-simulation.md` §M):

```json
{
  "sequence": 1,
  "type": "REQUEST_FEATURE",
  "status": "COMPLETED",
  "started_at": "2026-11-02T22:14:01.000Z",
  "completed_at": "2026-11-02T22:14:03.000Z",
  "summary": "Asked for a way to get a text when a nearby repair is scheduled.",
  "outcome": "Contact accepted.",
  "feature_request": {
    "title": "Text me when a repair near me is scheduled",
    "description": "I ride past these every night. Let me subscribe to a street and get a text when work is booked.",
    "reference_id": "01K8C4T1W7H3P9N2M6QZ8V0RJD"
  }
}
```

`reference_id` is the `contact_id` from the `201`, and stays `null` on a failed attempt.

**[OPEN], for the action design pass:**
- Which ideas may lead to `REQUEST_FEATURE`: only `FEATURE_REQUEST` ideas, or any idea at the model's discretion.
- The per-tool cap for `REQUEST_FEATURE` and the maximum actions per idea.
- Starting `action_weights` per resident when the bucket is granted.
- Whether the idea row's `client_request_id` is derived from `idea_id` and `sequence`, so a redelivered queue message can't file twice.
- A later `CHECK_CONTACT_STATUS` tool built on `GET /contacts/{contact_id}`.
- The web-app's residents mock still models a single `action`, and is to move to `actions[]`.
