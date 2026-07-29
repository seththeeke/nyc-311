# Data Model

> Negotiated **progressively, one entity at a time**, starting 2026-07-29. This
> doc extends the domain model in `claude-prompt-initial.md` §3 and the
> amendments in `capacity-model.md` / `business-insights.md` — where those
> docs sketched an entity at a conceptual level, this doc is the authoritative
> field-by-field spec. Where this doc and those disagree on entity/field
> detail, **this doc wins**; those docs remain authoritative for the
> surrounding architecture/workflow rationale.
>
> Real sample data is used throughout to sanity-check field design against
> what NYC 311 actually returns, rather than guessing. Samples live in
> `311-test-data/` (see `311-test-data/README.md`) and can be refreshed
> anytime with `node 311-test-data/pull-nyc-311-data.js --hours N`. A few
> representative real records pulled 2026-07-29 are embedded in
> **Appendix A**.
>
> This doc is expected to be built up across multiple sessions — see the
> status table below for what's settled vs. still to do.

---

## Entity Status

| Entity | Status | Notes |
|---|---|---|
| [Location](#location) | Defined | Identity = BBL; `LocationResolver` interface for unresolved records |
| [Request](#request) | Defined | New `draft` status for BBL-unresolved intake |
| [Order](#order) | Defined | Event-sourced; stage/event list finalized |
| [Case](#case) | Defined | `case_type` + `request_id` added; `public_demo` dropped (see [Deferred](#deferred--out-of-scope-for-now)) |
| [Operator](#operator) | Defined | Persistent, event-sourced; replaces the old "unit" concept 1:1 |
| [Shift](#shift) | Defined | Plain record — pure time-window + rate container, no longer event-sourced |
| [User](#user) | Defined | Expanded from `claude-prompt-initial.md` §3.1 with activity/audit fields |

---

## Location

Normalized real-world location, deduplicated by NYC's own parcel identifier
so recurring addresses (very common — see Appendix A) don't fragment into
duplicate records.

### Fields

| Field | Description |
|---|---|
| `location_id` | Identity of the Location. Equal to `bbl` — a Location is only ever created once a BBL has been resolved (see [Identity & deduplication](#identity--deduplication)). |
| `bbl` | NYC's official Borough-Block-Lot parcel identifier. Always present (by construction). |
| `address` | Street address, as reported on the source 311 record. |
| `borough` | NYC borough (`MANHATTAN`, `BROOKLYN`, `QUEENS`, `BRONX`, `STATEN ISLAND`). |
| `community_board` | NYC community board identifier. |
| `zip` | Postal code. |
| `latitude` / `longitude` | Geographic coordinates. |
| `created_at` | Timestamp the Location record was first created. |

### Identity & deduplication

- **`bbl` is the identity key.** Real sample data (1,387 records, 6-hour
  window): 86.6% carry a `bbl` directly; of the 13.4% that don't, ~79% are
  structurally parcel-less (`address_type = INTERSECTION` or `BLOCKFACE` — a
  street crossing or segment isn't a taxable parcel, so no BBL is expected to
  exist), and ~21% are real, specific addresses (`address_type = ADDRESS`)
  that 311's own system simply didn't geocode to a parcel.
- Recurrence matters in practice, not just in theory: 126 of 1,078 distinct
  addresses (~12%) repeated within a single 6-hour sample window.
- BBL isn't perfectly 1:1 with address strings either (14 BBLs in the sample
  mapped to 2+ different address strings — large parcels with multiple
  frontages, plus at least one straight formatting variant) — another reason
  BBL, not raw address text, is the identity key.

### `LocationResolver` interface

A pluggable interface (same pattern as `TransitTimeEstimator` /
`ProcessingTimeEstimator` in `capacity-model.md` §3) that attempts to resolve
a BBL for a `Request` that didn't arrive with one. **v1 implementation is a
stub / no-op** — it always fails to resolve. Runs synchronously at `Request`
intake; see [Request](#request) for what happens when it comes up empty.

Left open deliberately: a real future implementation (geocoding API call,
etc.) is a natural place to actually recover the ~21% "real address, no BBL"
bucket described above — not attempted in v1.

---

## Request

The raw intake record for a real ingested NYC 311 record. Not every Request
becomes an Order.

### Fields

| Field | Description |
|---|---|
| `request_id` | Identity of the Request. |
| `source` | `nyc_311`. (Single value for now — see [Deferred](#deferred--out-of-scope-for-now).) |
| `external_unique_key` | 311's `unique_key`. |
| `location_id` | FK to Location. Null while a Request is in `draft` (location unresolved). |
| `complaint_type` | As reported by 311. |
| `descriptor` | As reported by 311. |
| `agency` | Owning NYC agency. |
| `raw_payload` | Original source JSON. |
| `status` | `draft` \| `pending` \| `promoted` \| `filtered` \| `duplicate` \| `rejected`. |
| `created_by` | `user_id`. Null — always system-ingested for now. |
| `created_at` | Timestamp the Request was first created. |

### `status` and the location-resolution flow

`draft` is new (added this round). Flow at intake:

1. A Request is created from a raw 311 record (or a public submission).
2. If a `bbl` is present (or, later, if `LocationResolver` successfully
   resolves one), the corresponding `Location` is looked up or created
   (deduplicated by `bbl`), `location_id` is set, and `status` becomes
   `pending` — normal path into the existing promotion/filter/dedup logic.
3. If no `bbl` can be resolved, `status` is set to **`draft`**,
   `location_id` stays null, and this is the **first** trigger point for a
   `Case` — see [Case](#case), `case_type: location_resolution_failure`.

**Still open:** what actually transitions a `draft` Request out of that
state once its Case is resolved (e.g. does an agent-supplied resolution set
`location_id` and flip it to `pending`, or can it resolve to "no location
applies, proceed anyway"?) is explicitly deferred — to be designed alongside
the operator-persona action set in `capacity-model.md` §7.3.

---

## Order

Represents a dispatched job. Fully event-sourced — see
`claude-prompt-initial.md` §3.4 for the source-of-truth/projection split
rationale. Workflow stages (per `capacity-model.md` §8):
`Ingest → Schedule → Execute → Resolve`.

### `OrderEvent` (source of truth)

#### Fields

| Field | Description |
|---|---|
| `order_id` | Identity of the Order this event belongs to. |
| `sequence_number` | Monotonic per-Order ordering. |
| `event_type` | See table below. |
| `stage` | Nullable — one of `Ingest` \| `Schedule` \| `Execute` \| `Resolve`, for stage-scoped events. |
| `payload` | Event-specific data. |
| `occurred_at` | Timestamp. |
| `actor` | `system` \| `agent` \| `admin`. |

#### Event types

| `event_type` | Meaning |
|---|---|
| `OrderCreated` | Order created from a promoted Request. |
| `StageStarted` | A workflow stage began. |
| `StageSucceeded` | A workflow stage completed successfully. |
| `StageFailed` | A workflow stage failed (may or may not be terminal). |
| `StageRetried` | A workflow stage retried after failure. |
| `FailureInjected` | A chaos-testing failure was injected at this stage. |
| `PriorityAssigned` | `Ingest` stamps `priority_tier` (static base tier from `complaint_type`) and `sla_deadline` (the **queue-wait SLA** deadline per `capacity-model.md` §6 — not to be confused with the separate Case resolution-time SLA, which lives on `Case`). |
| `OrderScheduled` | `Schedule` stage computes and stamps the scheduled window (`scheduled_start`, `scheduled_end`). Window only — operator linkage is a separate event (below). |
| `OrderAssigned` | Stamps `operator_id`. First occurrence is the initial assignment (during `Schedule`); can recur later as a reassignment (e.g. due to disruption or a dynamic processing-time change), not necessarily confined to the `Schedule` stage. |
| `CaseCreated` | A Case was spawned from this Order (`workflow_execution_failure` or `capacity_sla_breach` — see [Case](#case)). |
| `OrderResolved` | Terminal — Order completed successfully. |
| `OrderFailedTerminal` | Terminal — Order failed with no further recovery path. |

### `Order` (projection)

| Field | Description |
|---|---|
| `order_id` | Identity. |
| `request_id` | FK to Request. |
| `location_id` | FK to Location. |
| `current_stage` | Current workflow stage. |
| `status` | Current Order status. |
| `retry_counts` | Map of `{Ingest, Schedule, Execute, Resolve} → count`, folded from `StageRetried` events. |
| `priority_tier` | Folded from `PriorityAssigned`. |
| `sla_deadline` | Folded from `PriorityAssigned` (queue-wait SLA deadline). |
| `scheduled_start` / `scheduled_end` | Folded from `OrderScheduled`. |
| `assigned_operator_id` | Folded from the latest `OrderAssigned`. Nullable until first assignment. |
| `reassignment_count` | Count of `OrderAssigned` events beyond the first. |
| `case_id` | Nullable FK to Case. |
| `created_at` / `updated_at` | Timestamps. |
| `last_event_sequence` | For replay/consistency checks — the projection must always be re-derivable by folding `OrderEvent`s from sequence 0. |

**Note on `Execute`:** the `Order` stream deliberately does *not* carry an
`OrderCheckedIn`-style event. The transit→work timeline for a job lives on
the assigned `Operator`'s own event log (see Operator, not yet started) —
`Order`'s `Execute` stage stays coarse (`StageStarted`/`StageSucceeded`
only). Anything needing the checked-in moment (cost-accrual clock,
time-in-stage detail) reads the Operator's event stream via
`assigned_operator_id`, rather than Order duplicating it.

---

## Shift

A concrete time-window instance for a pool (e.g. "DSNY–Queens, Tue
2026-07-28, 9am–5pm") — no longer event-sourced (see
[Operator](#operator) for where per-person activity tracking moved).
Plain record: config-like, not an activity timeline.

### Fields

| Field | Description |
|---|---|
| `shift_id` | Identity. |
| `pool` | Agency + borough pair this Shift belongs to (`capacity-model.md` §1). |
| `depot_id` | The pool's depot — Operators checked into this Shift originate from and return to this location. |
| `rate_per_hour` | Labor rate paid to any Operator checked into this Shift. Scoped to the Shift instance (not the Operator) specifically so shift-level pay differentials — night premium, weekend rate, etc. — are supported, and so historical cost stays stable by construction: a past Shift's rate never changes after the fact. |
| `scheduled_start` / `scheduled_end` | The planned window. |
| `status` | `scheduled` \| `active` \| `completed` \| `cancelled`. |
| `created_at` / `updated_at` | Timestamps. |

---

## Operator

Persistent entity — one record per (simulated) employee, existing
independently of any Shift and reused across many of them. Replaces the
original brief's "unit" concept 1:1 (no separate vehicle entity). Event-
sourced, same source-of-truth/projection split pattern as `Order`.

### `OperatorEvent` (source of truth)

One continuous stream per Operator across their whole tenure —
`CheckedIn`/`CheckedOut` mark shift-engagement boundaries within it, the
same way `stage` marks boundaries within an `Order`'s stream.

#### Fields

| Field | Description |
|---|---|
| `operator_id` | Identity of the Operator this event belongs to. |
| `sequence_number` | Monotonic per-Operator ordering. |
| `event_type` | See table below. |
| `payload` | Event-specific data. |
| `occurred_at` | Timestamp. |
| `actor` | `system` \| `agent` \| `admin`. |

#### Event types

| `event_type` | Meaning |
|---|---|
| `CheckedIn` | Begins an engagement for a specific `shift_id`. The paid rate for this engagement is read from that Shift's `rate_per_hour` — not stored on the event. |
| `TransitStarted` | Begins driving to a job (`order_id`). |
| `WorkStarted` | Begins on-site work (`order_id`) — the moment that would have been `OrderCheckedIn` on Order's own stream; see the note under [Order](#order). |
| `WorkCompleted` | Finishes on-site work (`order_id`). |
| `IdleStarted` | Waiting between jobs — paid, not attributable to any Order. |
| `ReturnToBaseStarted` | Paid drive back to the depot at shift end — also not attributable to any Order. |
| `CheckedOut` | Ends the engagement for `shift_id`. |

### `Operator` (projection)

| Field | Description |
|---|---|
| `operator_id` | Identity. |
| `function_type` | Agency-equivalent function this Operator is qualified for (e.g. NYPD, DSNY). |
| `status` | `active` \| `inactive` — employment status. |
| `current_shift_id` | Nullable FK to Shift. Set while checked in. |
| `current_activity` | `idle` \| `transit` \| `working` \| `off_shift` — folded from the latest event. What `CapacityAvailabilityProvider` (`capacity-model.md` §4) actually queries to determine real-time availability. |
| `created_at` / `updated_at` | Timestamps. |
| `last_event_sequence` | For replay/consistency checks. |

No `name`/display field for now — Operators are simulated, not real
employees, and `operator_id` + `function_type` is enough for UI/audit-trail
identification without adding data the project doesn't need.

---

## Case

Created when an Order's workflow fails in a way that needs handling, when an
Order breaches its queue-wait SLA, or when a Request can't be located.

### Fields

| Field | Description |
|---|---|
| `case_id` | Identity. |
| `order_id` | Nullable FK to Order. Null only for `location_resolution_failure` cases (no Order exists yet at that point). |
| `request_id` | Nullable FK to Request. Set for `location_resolution_failure` cases; null otherwise. |
| `case_type` | See table below. Replaces the original brief's coarser `source` field. |
| `queue` | `system-failure` \| `capacity-escalation` — owner-routing field. Derived from `case_type` but stored explicitly since it's what agent routing / IAM boundaries and queue-scoped queries key off (`capacity-model.md` §7). |
| `status` | `created` \| `under_investigation` \| `auto_resolved` \| `escalated` \| `resolved_by_admin` \| `closed`. |
| `created_by` | `user_id`. |
| `assigned_admin` | Nullable. |
| `created_at` / `updated_at` | Timestamps. |

Every remaining `case_type` now has a real originating Order or Request —
exactly one of `order_id` / `request_id` is set, never both null. (That
changed with this round's descope — see below.)

#### `case_type` values

| `case_type` | Queue | Trigger |
|---|---|---|
| `workflow_execution_failure` | system-failure | Exhausted retries / unrecoverable error at an Order workflow stage (original `claude-prompt-initial.md` §4.1 behavior). |
| `location_resolution_failure` | system-failure | `LocationResolver` couldn't produce a BBL for a Request (see [Request](#request)). |
| `capacity_sla_breach` | capacity-escalation | An Order's queue-wait exceeded its `sla_deadline` (`capacity-model.md` §6). |

### `CaseEvent` (append-only audit log)

| Field | Description |
|---|---|
| `case_id` | FK to Case. |
| `sequence_number` | Monotonic per-Case ordering. |
| `event_type` | `CaseCreated` \| `AgentInvestigationStarted` \| `AgentInvestigationCompleted` \| `AutoResolved` \| `EscalatedToHuman` \| `AdminResolved` \| `Closed`. |
| `payload` | Event-specific data — an investigation's model input/output, action taken, confidence, and reasoning live in `AgentInvestigationCompleted`'s payload. |
| `occurred_at` | Timestamp. |
| `actor` | `system` \| `agent` \| `admin`. |

**Still open:** the bounded action set per persona (`capacity-model.md`
§7.3, unchanged from that doc).

---

## User

Expands on `claude-prompt-initial.md` §3.1 with typical account/activity
fields, kept mindful of the project's non-goal of minimizing PII collection
(`claude-prompt-initial.md` §11) — the additions below are activity/audit
metadata, not new personal data. `public_actor` is dropped from the active
model this round along with the rest of the public write path — see
[Deferred](#deferred--out-of-scope-for-now).

### Fields

| Field | Description |
|---|---|
| `user_id` | Identity. |
| `type` | `admin`. (Single value for now.) |
| `status` | `active` \| `disabled`. Lets an account be revoked. |
| `created_at` | Timestamp. |
| `updated_at` | Timestamp. |
| `last_active_at` | Last login timestamp — backs admin session auditing. |
| `cognito_sub` | Cognito subject identifier. |
| `email` | Admin's login email. |
| `display_name` | Human-readable name surfaced in the Admin UI / audit trails (e.g. "resolved by Jane Doe" on a Case). |

---

## Deferred / out of scope (for now)

Dropped from the active model on 2026-07-29: the public tier is read-only
for now (public dashboard + read-only admin mirror,
`claude-prompt-initial.md` §5), not the read/write "public sandbox" tier
originally sketched. Revisit these together if/when public write comes
back:

- **`User.type = public_actor`** and its fields (`anonymous_id`, `ip_hash`,
  `request_count`) — no public-attributed write actions exist to attach
  them to right now.
- **`Location.is_fake` / `Location.registered_by`** — no public
  "register a fake location" flow.
- **`Request.source = public_demo`** — no public-submitted Requests.
- **`Case.case_type = public_demo`** — no public-filed Cases. This also
  simplified `Case.order_id`/`request_id` nullability — see [Case](#case).

---

## Appendix A: Sample Data

Source: `311-test-data/nyc-311-6h-2026-07-29T16-06-30-930Z.json` (1,387
records, pulled 2026-07-29 — see `311-test-data/README.md` to refresh).
Three representative raw records, illustrating the `Location`/`Request`
identity-resolution buckets discussed above.

### 1. Normal case — `bbl` present

```json
{
  "unique_key": "69860415",
  "created_date": "2026-07-27T21:03:35.000",
  "agency": "NYPD",
  "complaint_type": "Noise - Street/Sidewalk",
  "descriptor": "Loud Talking",
  "incident_zip": "10462",
  "incident_address": "2106 WALLACE AVENUE",
  "address_type": "ADDRESS",
  "community_board": "11 BRONX",
  "bbl": "2042920014",
  "borough": "BRONX",
  "latitude": "40.8534000790689",
  "longitude": "-73.86483648294009"
}
```

### 2. Structurally no BBL — `address_type: INTERSECTION`

```json
{
  "unique_key": "69860394",
  "created_date": "2026-07-27T21:04:05.000",
  "agency": "NYPD",
  "complaint_type": "Noise - Street/Sidewalk",
  "descriptor": "Loud Music/Party",
  "incident_zip": "10001",
  "incident_address": "WEST 34 STREET",
  "intersection_street_1": "WEST 34 STREET",
  "intersection_street_2": "BROADWAY",
  "address_type": "INTERSECTION",
  "community_board": "05 MANHATTAN",
  "borough": "MANHATTAN",
  "latitude": "40.74985424754985",
  "longitude": "-73.98793821748563"
}
```

No `bbl` field at all — expected, an intersection isn't a taxable parcel.
`LocationResolver` should not be expected to resolve this one; it's
structurally correct for the Location to never exist for this Request.

### 3. Geocoding gap — real address, still no BBL

```json
{
  "unique_key": "69869510",
  "created_date": "2026-07-27T21:11:08.000",
  "agency": "DCWP",
  "complaint_type": "Consumer Complaint",
  "descriptor": "Stoop Line Stand",
  "incident_zip": "10036",
  "incident_address": "201 WEST 42 STREET",
  "address_type": "ADDRESS",
  "community_board": "05 MANHATTAN",
  "borough": "MANHATTAN",
  "latitude": "40.75613414399541",
  "longitude": "-73.98716464920986"
}
```

`address_type: ADDRESS` with a specific street address, but 311 itself
didn't attach a `bbl`. This is the bucket a real future `LocationResolver`
implementation could plausibly recover; the v1 stub will not.
