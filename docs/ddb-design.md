# DynamoDB Table Design

> Negotiated **table by table, starting 2026-07-29**, the same
> progressive/negotiated style as `data-model.md`. Resolves the `[OPEN]`
> item from `claude-prompt-initial.md` §3.6 and the "DynamoDB schema
> implications" line in `capacity-model.md` §9.
>
> **Strategy: hybrid, one table per aggregate** (decided 2026-07-29).
> `Order`+`OrderEvent`, `Case`+`CaseEvent`, and `Operator`+`OperatorEvent`
> each get their own table, using the single-table "item collection"
> pattern (root + its events share a partition key, fetched together in one
> `Query`). `Location`, `Request`, `Shift`, and `User` — plain records with
> no event-log child — each get their own simple table. Seven tables total.
>
> Documentation convention for every table in this doc: **every GSI is
> documented with its intended access pattern(s) explicitly**, not just its
> key shape — so a later design can look it up and confirm a new query
> actually matches what the index was built for, rather than assuming.
>
> Each table's design is reviewed and locked in three steps: base key
> schema → GSIs (with intended access patterns) → CDK snippet (with any
> config knobs flagged as explicit decisions, not silent defaults). Only
> committed to this doc once all three are agreed.

---

## Table Status

| Table | Backs | Status |
|---|---|---|
| [Orders](#orders-table) | `Order` + `OrderEvent` | **Agreed** |
| [Cases](#cases-table) | `Case` + `CaseEvent` | **Agreed** |
| [Operators](#operators-table) | `Operator` + `OperatorEvent` | **Agreed** |
| [Locations](#locations-table) | `Location` | **Agreed** |
| [Requests](#requests-table) | `Request` | **Agreed** |
| [Shifts](#shifts-table) | `Shift` | **Agreed** |
| [Users](#users-table) | `User` | **Agreed** |

---

## Shared pattern: aggregate tables

`Orders`, `Cases`, and `Operators` all follow the same shape:

- **Partition key** = the aggregate's id (`order_id` / `case_id` /
  `operator_id`).
- **Sort key**: `#METADATA` for the single projection/root item, or
  `EVENT#<sequence_number, zero-padded to 10 digits>` for each event.
  Zero-padding keeps lexicographic (string) sort equal to numeric sort.
  `#` (0x23) sorts before digits and letters, so `#METADATA` naturally
  appears first in a `Query` result — root item first, then its full event
  history in order.
- A single `Query` on the partition key retrieves the current projection
  *and* the full audit trail together — the main reason this pattern earns
  its keep here.
- **Write path**: appending an event and updating the projection happen in
  one `TransactWriteItems` call — `Put` the new `EVENT#<n>` item, `Update`
  the `#METADATA` item's derived fields, condition-check that
  `last_event_sequence` still equals `n - 1`. This is the optimistic-lock
  guard against two concurrent writers (e.g. a retried Lambda invocation)
  double-appending or clobbering each other's projection update.

---

## Orders table

Backs `Order` (event-sourced) — see `data-model.md#order`.

### Key schema

| Item type | PK (`order_id`) | SK | Notes |
|---|---|---|---|
| Order projection | `order_id` | `#METADATA` | Current-state fields per `data-model.md#order` (`current_stage`, `status`, `retry_counts`, `priority_tier`, `sla_deadline`, `scheduled_start`/`end`, `assigned_operator_id`, `reassignment_count`, `case_id`, `last_event_sequence`, ...). |
| OrderEvent | `order_id` | `EVENT#<sequence_number>` | Immutable, per `data-model.md#order` event type table. |

### GSIs

**GSI1 — `gsi1-stage-sla`**
`gsi1pk = "STAGE#" + current_stage`, `gsi1sk = sla_deadline`. Sparse — set
only on projection items, never on event items.

**Intended access pattern(s):**
- Capacity engine's dispatch loop: `Query gsi1pk = "STAGE#Schedule"` sorted
  ascending by `sla_deadline` returns the queue in the exact order it
  should be worked.
- Doubles as the queue-wait SLA-breach scan (`capacity-model.md` §6) —
  within that same sorted result, anything with `sla_deadline < now` is
  already in breach. One index serves both because only Orders sitting in
  `Schedule` can breach the queue-wait SLA in the first place.
- Incidentally also answers "how many Orders are in stage X" for any
  stage (`STAGE#Ingest`, `STAGE#Execute`, `STAGE#Resolve`) — ops
  visibility, not just the Schedule-stage queue.

**Known tradeoff:** `current_stage` has only 4 possible values, so
`STAGE#Schedule` is a single hot partition under real load. Non-issue at
this project's actual volume (a few 311 polls/day); noted as a known
limitation, not an oversight, in case this pattern gets reused somewhere
higher-volume later.

**GSI2 — `gsi2-assigned-operator`**
`gsi2pk = assigned_operator_id`, `gsi2sk = updated_at`. Sparse — only set
once an Order has been assigned (post-`OrderAssigned`).

**Intended access pattern(s):**
- Current Order assignment(s) for a given Operator — a direct lookup.
  Secondary to the Operator's own `OperatorEvent` stream (the authoritative
  `TransitStarted{order_id}`/`WorkStarted{order_id}` history), but avoids
  having to fold an Operator's entire event history just to answer "what
  are they on right now."

### Design notes

- **No GSI for "Order by request_id."** `Request → Order` is 0..1 and the
  `Order` projection already stores `request_id`. The promotion write
  (`Request.status → promoted`) denormalizes `order_id` back onto the
  `Request` item at the same time, so "does this Request have an Order,
  and which one" is a single `GetItem` on `Requests`, not a secondary
  index here. (To be confirmed when the Requests table is designed.)
- **No GSI for "Order by case_id."** Same shape in reverse — the `Case`
  item stores `order_id`, and the `Order` projection stores `case_id`.
  Either direction is a direct `GetItem`, never a `Query`.

### CDK

```typescript
import { TableV2, AttributeType, ProjectionType, StreamViewType } from 'aws-cdk-lib/aws-dynamodb';
import { RemovalPolicy } from 'aws-cdk-lib';

const ordersTable = new TableV2(this, 'OrdersTable', {
  tableName: 'Orders',
  partitionKey: { name: 'order_id', type: AttributeType.STRING },
  sortKey: { name: 'sk', type: AttributeType.STRING },
  // Intended access pattern: Query(PK=order_id) returns the projection
  // (#METADATA) + full OrderEvent history in one call, sorted.

  // On-demand (TableV2 default) — fits a low/spiky/unpredictable-volume
  // workload (a few 311 polls/day) with no capacity planning needed.
  pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
  dynamoStream: StreamViewType.NEW_AND_OLD_IMAGES,
  removalPolicy: RemovalPolicy.RETAIN, // all environments

  globalSecondaryIndexes: [
    {
      indexName: 'gsi1-stage-sla',
      // Intended access pattern: Schedule-stage dispatch queue sorted by
      // sla_deadline; doubles as the SLA-breach scan. Sparse — only
      // projection items set gsi1pk.
      partitionKey: { name: 'gsi1pk', type: AttributeType.STRING }, // "STAGE#" + current_stage
      sortKey: { name: 'gsi1sk', type: AttributeType.STRING },      // sla_deadline (ISO 8601)
      projectionType: ProjectionType.ALL,
    },
    {
      indexName: 'gsi2-assigned-operator',
      // Intended access pattern: current Order assignment(s) for a given
      // Operator. Sparse — only set post-OrderAssigned.
      partitionKey: { name: 'gsi2pk', type: AttributeType.STRING }, // assigned_operator_id
      sortKey: { name: 'gsi2sk', type: AttributeType.STRING },      // updated_at (ISO 8601)
      projectionType: ProjectionType.ALL,
    },
  ],
});
```

**Decisions locked for this table (2026-07-29):** on-demand billing, PITR
enabled, stream view `NEW_AND_OLD_IMAGES`, `RemovalPolicy.RETAIN` in all
environments, `ProjectionType.ALL` on all GSIs. These same defaults will be
proposed (not assumed) for the remaining six tables, table by table.

---

## Cases table

Backs `Case` + `CaseEvent` (mutable root + audit log) — see
`data-model.md#case`.

### Key schema

| Item type | PK (`case_id`) | SK | Notes |
|---|---|---|---|
| Case | `case_id` | `#METADATA` | Fields per `data-model.md#case` (`order_id`, `request_id`, `case_type`, `queue`, `status`, `sla_deadline`, `created_by`, `assigned_owner`, ...). |
| CaseEvent | `case_id` | `EVENT#<sequence_number>` | Per `data-model.md#case` event type table. |

### GSIs

**GSI1 — `gsi1-queue-status`**
`gsi1pk = queue`, `gsi1sk = status + "#" + created_at`. Sparse — Case
(`#METADATA`) items only.

**Intended access pattern(s):**
- The core admin surface from `capacity-model.md` §7.1: `Query gsi1pk =
  "system-failure"` or `"capacity-escalation"`, narrowable to a `status`
  via a sort-key prefix, drives each queue's owner-specific work list.

**Known tradeoff:** `queue` has only 2 possible values — same hot-partition
shape as the Orders `gsi1pk`, same call: acceptable at this project's
volume, worth naming if this pattern gets reused somewhere higher-volume.

**GSI2 — `gsi2-assigned-owner`**
`gsi2pk = assigned_owner`, `gsi2sk = updated_at`. Sparse — only set once a
Case is escalated to a human.

**Intended access pattern(s):**
- "My assigned Cases" view for a logged-in admin.

### Design notes

- **`Case.sla_deadline` added to `data-model.md` (2026-07-29)** — the
  resolution-time SLA clock (`business-insights.md` §2.2), distinct from
  `Order.sla_deadline` (the queue-wait SLA). **Deliberately no GSI for
  scanning it.** The resolution-time SLA-breach *rate* is a reporting
  metric served by the Athena/analytics pipeline (`business-insights.md`
  §3), not a live operational query against this table — most consumers of
  this field are batch jobs, not the operational site, so a dedicated
  index isn't earning its keep here.
- **`Case.assigned_admin` renamed to `Case.assigned_owner`** in
  `data-model.md` (2026-07-29) — `assigned_operator` was considered and
  rejected: `Operator` already names the distinct, fully-specified
  event-sourced field-crew entity elsewhere in this model, and reusing the
  word for "the admin handling this Case" would collide with it in code,
  docs, and this table's own GSI2 semantics.
- No GSI for "Case by order_id / request_id" — same direct-`GetItem`
  reasoning as the Orders table (`Order` stores `case_id`; `Request` will
  get the same treatment for `location_resolution_failure` Cases — to be
  confirmed when the Requests table is designed).

### CDK

```typescript
const casesTable = new TableV2(this, 'CasesTable', {
  tableName: 'Cases',
  partitionKey: { name: 'case_id', type: AttributeType.STRING },
  sortKey: { name: 'sk', type: AttributeType.STRING },
  // Intended access pattern: Query(PK=case_id) returns the Case record
  // (#METADATA) + full CaseEvent audit trail in one call, sorted.

  pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
  dynamoStream: StreamViewType.NEW_AND_OLD_IMAGES,
  removalPolicy: RemovalPolicy.RETAIN, // all environments

  globalSecondaryIndexes: [
    {
      indexName: 'gsi1-queue-status',
      // Intended access pattern: dispatcher/operator work-queue view,
      // Query(gsi1pk=queue) narrowed by a status prefix on gsi1sk.
      // Sparse — only Case (#METADATA) items set gsi1pk.
      partitionKey: { name: 'gsi1pk', type: AttributeType.STRING }, // queue
      sortKey: { name: 'gsi1sk', type: AttributeType.STRING },      // status + "#" + created_at
      projectionType: ProjectionType.ALL,
    },
    {
      indexName: 'gsi2-assigned-owner',
      // Intended access pattern: "my assigned Cases" for a logged-in
      // admin. Sparse — only set once a Case is escalated to a human.
      partitionKey: { name: 'gsi2pk', type: AttributeType.STRING }, // assigned_owner
      sortKey: { name: 'gsi2sk', type: AttributeType.STRING },      // updated_at (ISO 8601)
      projectionType: ProjectionType.ALL,
    },
  ],
});
```

Same defaults as Orders: on-demand billing, PITR enabled, `NEW_AND_OLD_IMAGES`
stream, `RemovalPolicy.RETAIN` in all environments, `ProjectionType.ALL` on
all GSIs.

---

## Operators table

Backs `Operator` (event-sourced) — see `data-model.md#operator`.

### Key schema

| Item type | PK (`operator_id`) | SK | Notes |
|---|---|---|---|
| Operator projection | `operator_id` | `#METADATA` | Fields per `data-model.md#operator` (`function_type`, `status`, `current_shift_id`, `current_activity`, `last_event_sequence`, ...). |
| OperatorEvent | `operator_id` | `EVENT#<sequence_number>` | Per `data-model.md#operator` event type table — one continuous stream per Operator across their whole tenure. |

### GSIs

**GSI1 — `gsi1-current-shift`**
`gsi1pk = current_shift_id`, `gsi1sk = current_activity`. Sparse — only set
while `current_shift_id` is non-null (checked in).

**Intended access pattern(s):**
- Step 2 of the `CapacityAvailabilityProvider` query (`capacity-model.md`
  §4): step 1 finds a pool's active `Shift`s (Shifts table GSI1), step 2 is
  `Query gsi1pk = <shift_id>` per active shift to get its checked-in
  Operators, filterable by `current_activity = idle` for "who's actually
  free right now."

**GSI2 — `gsi2-function-status`**
`gsi2pk = function_type + "#" + status`, `gsi2sk = current_activity`.

**Intended access pattern(s):**
- Coarser admin/ops roster view not scoped to a single shift — "how many
  DSNY Operators are active system-wide, and what are they doing right
  now." Not on the hot dispatch path (that's GSI1, reached via Shift); this
  is for the admin dashboard's operator roster.

### Design notes

- Operator has no direct `pool` (agency+borough) field — pool affiliation
  is only known through whichever `Shift` an Operator is currently checked
  into. This is why availability is a two-step query (Shifts → Operators)
  rather than a single index on Operators keyed by pool directly —
  consistent with `data-model.md` framing `Operator` as persistent/
  pool-agnostic and `Shift` as the pool-scoped concept.

### CDK

```typescript
const operatorsTable = new TableV2(this, 'OperatorsTable', {
  tableName: 'Operators',
  partitionKey: { name: 'operator_id', type: AttributeType.STRING },
  sortKey: { name: 'sk', type: AttributeType.STRING },
  // Intended access pattern: Query(PK=operator_id) returns the projection
  // (#METADATA) + full OperatorEvent tenure history in one call, sorted.

  pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
  dynamoStream: StreamViewType.NEW_AND_OLD_IMAGES,
  removalPolicy: RemovalPolicy.RETAIN, // all environments

  globalSecondaryIndexes: [
    {
      indexName: 'gsi1-current-shift',
      // Intended access pattern: capacity-availability step 2 — checked-in
      // Operators for a given Shift, filterable by current_activity.
      // Sparse — only set while checked in.
      partitionKey: { name: 'gsi1pk', type: AttributeType.STRING }, // current_shift_id
      sortKey: { name: 'gsi1sk', type: AttributeType.STRING },      // current_activity
      projectionType: ProjectionType.ALL,
    },
    {
      indexName: 'gsi2-function-status',
      // Intended access pattern: admin roster view by function_type +
      // employment status, system-wide (not shift-scoped).
      partitionKey: { name: 'gsi2pk', type: AttributeType.STRING }, // function_type + "#" + status
      sortKey: { name: 'gsi2sk', type: AttributeType.STRING },      // current_activity
      projectionType: ProjectionType.ALL,
    },
  ],
});
```

Same defaults throughout: on-demand billing, PITR enabled,
`NEW_AND_OLD_IMAGES` stream (feeds the analytics pipeline the same way
`OrderEvent`/`CaseEvent` do — supersedes `business-insights.md` §3.1's
stale reference to a `ShiftEvent` stream, since `Shift` is no longer
event-sourced per `data-model.md`), `RemovalPolicy.RETAIN`,
`ProjectionType.ALL` on all GSIs.

---

## Locations table

Backs `Location` (plain record) — see `data-model.md#location`.

### Key schema

| Item type | PK (`location_id`, = `bbl`) | SK |
|---|---|---|
| Location | `location_id` | *(none — single-item table)* |

### GSIs

None. Every identified access pattern is a direct `GetItem`, or a
conditional `PutItem` (`attribute_not_exists(location_id)`) for dedup-by-
`bbl` at intake — the primary key alone enforces that. No borough- or
community-board-scoped query on raw `Location` records has surfaced;
dashboard aggregates by borough are served from the analytics pipeline's
own dedicated tables (`business-insights.md` §3.6), not from this table.

### CDK

```typescript
const locationsTable = new TableV2(this, 'LocationsTable', {
  tableName: 'Locations',
  partitionKey: { name: 'location_id', type: AttributeType.STRING }, // = bbl
  // Intended access pattern: GetItem(location_id) for direct lookup;
  // conditional PutItem for dedup-by-bbl at Request intake. No SK, no
  // GSIs — no query pattern beyond single-item access has surfaced.

  pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
  removalPolicy: RemovalPolicy.RETAIN, // all environments
});
```

No stream — no downstream consumer needs Location change capture today.
Same billing/PITR/removal defaults as the other tables.

---

## Requests table

Backs `Request` — see `data-model.md#request`.

### Key schema

| Item type | PK (`request_id`) | SK |
|---|---|---|
| Request | `request_id` | *(none)* |

### GSIs

**GSI1 — `gsi1-external-key`**
`gsi1pk = external_unique_key`. Sparse — only real (`nyc_311`-sourced)
Requests populate this.

**Intended access pattern(s):**
- Ingestion dedup check — "has this 311 `unique_key` already been
  ingested," run on **every** ingested record, every poll. Highest-
  frequency query against this table by a wide margin.

**GSI2 — `gsi2-status`**
`gsi2pk = status`, `gsi2sk = created_at`.

**Intended access pattern(s):**
- Processing queues: `draft` (needs location resolution / has an open
  `location_resolution_failure` Case) and `pending` (awaiting
  promotion/filter/dedup decision).

**GSI3 — `gsi3-location`**
`gsi3pk = location_id`, `gsi3sk = created_at`. Sparse — null while
`status = draft` (no `location_id` yet).

**Intended access pattern(s):**
- "Recurring requests at this address" — a real pattern, not just
  theoretical: `data-model.md` Appendix A found ~12% of addresses repeat
  within a single 6-hour sample window.

**GSI4 — `gsi4-poller-metrics`** (added 2026-08-15, `1-data-ingestion.md`
§8a)
`gsi4pk = "POLLER#METRICS"` (fixed constant, every poller-metrics item sets
the same value), `gsi4sk = ran_at`. Sparse — only poller-metrics items set
`gsi4pk`/`gsi4sk`; real Request items and the `CURSOR#NYC_311` sentinel
never do.

**Intended access pattern(s):**
- The public ingestion-metrics API's only query: `Query gsi4pk =
  "POLLER#METRICS"`, `ScanIndexForward: false` — every recorded poller run,
  most recent first. This table has no sort key on its base key schema, so
  a growing, listable history of items genuinely requires a composite key
  *somewhere*; putting it on a sparse GSI rather than the base table avoids
  any change to the Requests table's existing (request_id-only) primary key,
  and thus any risk to already-ingested Test/Prod data.

### Design notes

- **Denormalized `order_id`** is written onto the `Request` item at
  promotion (`status → promoted`) — confirmed here, referenced from the
  Orders table's design notes. Avoids a reverse GSI on Orders for "does
  this Request have an Order."
- **Denormalized `case_id`** is written onto the `Request` item whenever a
  `location_resolution_failure` Case is created for it (`data-model.md`
  Case's `request_id` FK is the inverse of this link). Same reasoning as
  `order_id`: this is a rare, one-directional lookup ("does this draft
  Request have an open Case"), not worth a reverse GSI on the Cases table
  for.
- **Ingestion cursor lives here too, as a sentinel item.** `request_id =
  "CURSOR#nyc_311"` (a fixed string — safe from colliding with real
  `request_id`s once those are ULIDs, per the "Still Open" ID-generation
  item below) holds the poller's last-drained watermark and, when a run
  hits its per-invocation record cap mid-window, a resume offset. It sets
  none of `external_unique_key`, `status`, or `location_id`, so it never
  appears in any of the three GSIs above (all sparse) — only reachable via
  direct `GetItem`/`PutItem` on its known PK. Full design and rationale:
  `1-data-ingestion.md` §2.
- **Poller-metrics history also lives here** (added 2026-08-15,
  `1-data-ingestion.md` §8a) — one item per poller invocation, keyed
  `request_id = "METRIC#<ulid>"` (unique per run, never a real Request's id
  or the cursor sentinel) with `gsi4pk`/`gsi4sk` set for GSI4 above. Same
  "sentinel-shaped item sharing the base table" pattern as the cursor, just
  one-item-per-run instead of a single overwritten item, since this needs
  to be listable as a history rather than looked up by a known key.

### CDK

```typescript
const requestsTable = new TableV2(this, 'RequestsTable', {
  tableName: 'Requests',
  partitionKey: { name: 'request_id', type: AttributeType.STRING },
  // Intended access pattern: GetItem(request_id) for direct lookup.

  pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
  removalPolicy: RemovalPolicy.RETAIN, // all environments

  globalSecondaryIndexes: [
    {
      indexName: 'gsi1-external-key',
      // Intended access pattern: ingestion dedup check by 311
      // unique_key — the highest-frequency query on this table.
      // Sparse — only nyc_311-sourced Requests populate gsi1pk.
      partitionKey: { name: 'gsi1pk', type: AttributeType.STRING }, // external_unique_key
      projectionType: ProjectionType.ALL,
    },
    {
      indexName: 'gsi2-status',
      // Intended access pattern: draft/pending processing queues.
      partitionKey: { name: 'gsi2pk', type: AttributeType.STRING }, // status
      sortKey: { name: 'gsi2sk', type: AttributeType.STRING },      // created_at
      projectionType: ProjectionType.ALL,
    },
    {
      indexName: 'gsi3-location',
      // Intended access pattern: recurring-requests-at-this-address view.
      // Sparse — null while status = draft.
      partitionKey: { name: 'gsi3pk', type: AttributeType.STRING }, // location_id
      sortKey: { name: 'gsi3sk', type: AttributeType.STRING },      // created_at
      projectionType: ProjectionType.ALL,
    },
    {
      indexName: 'gsi4-poller-metrics',
      // Intended access pattern: NYC 311 poller run history, most recent
      // first — the public ingestion-metrics API's only query. Sparse —
      // only poller-metrics items set gsi4pk/gsi4sk.
      partitionKey: { name: 'gsi4pk', type: AttributeType.STRING }, // "POLLER#METRICS" constant
      sortKey: { name: 'gsi4sk', type: AttributeType.STRING },      // ran_at
      projectionType: ProjectionType.ALL,
    },
  ],
});
```

No stream — `Request` isn't event-sourced and no downstream consumer needs
its change capture today. Same billing/PITR/removal defaults otherwise.

---

## Shifts table

Backs `Shift` (plain record) — see `data-model.md#shift`.

### Key schema

| Item type | PK (`shift_id`) | SK |
|---|---|---|
| Shift | `shift_id` | *(none)* |

### GSIs

**GSI1 — `gsi1-pool`**
`gsi1pk = pool`, `gsi1sk = status + "#" + scheduled_start`.

**Intended access pattern(s):**
- Step 1 of the `CapacityAvailabilityProvider` query: `Query gsi1pk =
  "DSNY#QUEENS"` prefixed to `status = active` for "which Shifts are live
  for this pool right now" — feeds into the Operators-table GSI1 lookup.
- The same index, queried without the `active` prefix restriction and
  sorted by `scheduled_start`, also serves the staffing/forecasting view
  (`capacity-model.md` §4.1) — the upcoming shift schedule for a pool.

### Design notes

- No GSI on `depot_id` — no access pattern requiring "all Shifts at depot
  X" independent of pool has surfaced, and a depot is 1:1 with a pool
  (`capacity-model.md` §1), so querying by pool already gets you there.

### CDK

```typescript
const shiftsTable = new TableV2(this, 'ShiftsTable', {
  tableName: 'Shifts',
  partitionKey: { name: 'shift_id', type: AttributeType.STRING },
  // Intended access pattern: GetItem(shift_id) for direct lookup.

  pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
  removalPolicy: RemovalPolicy.RETAIN, // all environments

  globalSecondaryIndexes: [
    {
      indexName: 'gsi1-pool',
      // Intended access pattern: capacity-availability step 1 (active
      // Shifts for a pool) and the staffing/forecasting upcoming-shifts
      // view (same index, unfiltered).
      partitionKey: { name: 'gsi1pk', type: AttributeType.STRING }, // pool
      sortKey: { name: 'gsi1sk', type: AttributeType.STRING },      // status + "#" + scheduled_start
      projectionType: ProjectionType.ALL,
    },
  ],
});
```

No stream — `Shift` isn't event-sourced (per-person activity tracking
lives on `Operator` instead). Same billing/PITR/removal defaults
otherwise.

---

## Users table

Backs `User` — see `data-model.md#user`.

### Key schema

| Item type | PK (`user_id`) | SK |
|---|---|---|
| User | `user_id` | *(none)* |

### GSIs

**GSI1 — `gsi1-cognito-sub`**
`gsi1pk = cognito_sub`.

**Intended access pattern(s):**
- Login-path lookup — resolving a Cognito-authenticated request's `sub`
  claim to the internal `User` record.

### CDK

```typescript
const usersTable = new TableV2(this, 'UsersTable', {
  tableName: 'Users',
  partitionKey: { name: 'user_id', type: AttributeType.STRING },
  // Intended access pattern: GetItem(user_id) for direct lookup.

  pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
  removalPolicy: RemovalPolicy.RETAIN, // all environments

  globalSecondaryIndexes: [
    {
      indexName: 'gsi1-cognito-sub',
      // Intended access pattern: Cognito login lookup by sub claim.
      partitionKey: { name: 'gsi1pk', type: AttributeType.STRING }, // cognito_sub
      projectionType: ProjectionType.ALL,
    },
  ],
});
```

No stream — no downstream consumer needs `User` change capture today. Same
billing/PITR/removal defaults otherwise.

---

## Access Pattern Index

Every access pattern identified across `claude-prompt-initial.md`,
`data-model.md`, `capacity-model.md`, and `business-insights.md`, mapped to
what serves it. Use this to sanity-check the design for gaps — if a real
pattern isn't in this list, the tables/indexes above probably don't serve
it yet.

| # | Access pattern | Served by |
|---|---|---|
| 1 | Get Order (current state) + full event history, by `order_id` | Orders table, `Query PK=order_id` |
| 2 | Append an OrderEvent, update projection atomically | Orders table, `TransactWriteItems` |
| 3 | List Orders in `Schedule` stage, sorted for dispatch / SLA-breach scan | Orders `gsi1-stage-sla` |
| 4 | Does this Request have an Order, and which one | Requests table (denormalized `order_id`) |
| 5 | Orders currently assigned to a given Operator | Orders `gsi2-assigned-operator` |
| 6 | Get Case + full event history, by `case_id` | Cases table, `Query PK=case_id` |
| 7 | Append a CaseEvent, update Case atomically | Cases table, `TransactWriteItems` |
| 8 | List open Cases in a given queue (system-failure / capacity-escalation) | Cases `gsi1-queue-status` |
| 9 | List Cases assigned to a given owner | Cases `gsi2-assigned-owner` |
| 10 | Cases past their resolution-time SLA deadline | Deliberately unindexed — served by the Athena/analytics pipeline (`business-insights.md` §3), not a live query |
| 11 | Get Operator (current state) + full tenure event history, by `operator_id` | Operators table, `Query PK=operator_id` |
| 12 | Append an OperatorEvent, update projection atomically | Operators table, `TransactWriteItems` |
| 13 | Operators checked into a given Shift (capacity availability, step 2) | Operators `gsi1-current-shift` |
| 14 | Operators by function type + status (admin roster view) | Operators `gsi2-function-status` |
| 15 | Get Location by `bbl` | Locations table, `GetItem` |
| 16 | Create Location if absent, deduped by `bbl` | Locations table, conditional `PutItem` |
| 17 | Get Request by `request_id` | Requests table, `GetItem` |
| 18 | Dedup check by `external_unique_key` (every ingested record) | Requests `gsi1-external-key` |
| 19 | List Requests by status (`draft` / `pending` processing queues) | Requests `gsi2-status` |
| 20 | List Requests at a given Location (recurring-address view) | Requests `gsi3-location` |
| 21 | Does this draft Request have an open Case | Requests table (denormalized `case_id`) |
| 22 | Get Shift by `shift_id` | Shifts table, `GetItem` |
| 23 | Active Shifts for a given pool (capacity availability, step 1) | Shifts `gsi1-pool` |
| 24 | Upcoming/scheduled Shifts for a pool (staffing/forecasting) | Shifts `gsi1-pool` (unfiltered) |
| 25 | Get User by `user_id` | Users table, `GetItem` |
| 26 | Get User by `cognito_sub` (login) | Users `gsi1-cognito-sub` |
| 27 | Get/update the NYC 311 ingestion cursor (watermark + resume offset) | Requests table, `GetItem`/`PutItem` on sentinel PK `"CURSOR#nyc_311"` — see Requests table design notes and `1-data-ingestion.md` §2 |
| 28 | List the NYC 311 poller's full run history, most recent first (public ingestion-metrics API) | Requests `gsi4-poller-metrics` — see Requests table design notes and `1-data-ingestion.md` §8a |

---

## Still Open

- **Low-cardinality GSI partition keys** (`gsi1-stage-sla` on Orders,
  `gsi1-queue-status` on Cases — a handful of possible values each) are a
  textbook hot-partition risk at real scale. Named explicitly in each
  table's section as a known tradeoff, acceptable at this project's actual
  volume (a few 311 polls/day) — if this were a real production system,
  these would need write-sharding (e.g. a random suffix on the partition
  key, fanned back in at read time).
- ~~**ID generation scheme** (UUID v4 vs. ULID/KSUID)~~ — **Resolved
  2026-08-10: ULID, project-wide**, decided in `1-data-ingestion.md` §6
  while designing the ingestion cursor's sentinel-PK collision-safety. Still
  true that this doesn't require changing any key schema above — `created_at`
  sort keys stay as designed, ULID just makes some of them incidentally
  redundant with the id itself, not worth removing for the small win.
- **TTL/archival policy for event-log items** (`OrderEvent`, `CaseEvent`,
  `OperatorEvent`) — none proposed yet. These grow unboundedly per
  aggregate; the analytics pipeline already drains them into S3, so a
  DynamoDB TTL on old event items (once safely past the Firehose export) is
  a plausible future cost control, not designed here.
- **Glue/Athena table DDL and the dedicated per-metric dashboard tables**
  (`business-insights.md` §3.5/§3.6) are explicitly out of scope for this
  doc — those are analytics-layer tables fed *from* these operational
  tables via DynamoDB Streams, not part of the operational schema itself.
- **`business-insights.md` §1.2/§3.1 reference a `ShiftEvent` stream** that
  no longer exists — `Shift` was changed to a plain (non-event-sourced)
  record in `data-model.md`, with per-person activity tracking moved to
  `OperatorEvent` instead. This table design already reflects the current
  (`data-model.md`) reality (see Operators table CDK notes), but
  `business-insights.md` itself hasn't been updated to match — worth a
  cleanup pass on that doc.
