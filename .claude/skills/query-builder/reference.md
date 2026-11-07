# Warehouse reference

Compiled from `cdk/warehouse/warehouseTableSchemas.ts` (columns),
`backend/models/*.ts` (enum values, payloads), `docs/v1-wbr.sql` (the WBR's
definitions) and `docs/7-data-warehousing.md`. The schemas file wins on any
disagreement.

Every table also carries `dt` (`YYYY-MM-DD`, the day the row was warehoused,
not a business date), `warehouse_ingested_at` (string) and
`ingestion_source` (`STREAM` | `REBUILD`).

**Enum values are `ALL_CAPS`, as persisted** (CLAUDE.md §6). `docs/data-model.md`
writes several in lowercase and describes an older design in places; trust
this file and `backend/models/` over it. `borough` is the one free-text field.

## Tables

### `order_events`
One row per Order event. The append-only history: **counts and "is this Order
done" come from here.**
`order_id`, `sequence_number` (bigint), `event_type`, `stage` (nullable),
`occurred_at` (ISO string), `actor`, `payload` (JSON string).
- `event_type`: `ORDER_CREATED`, `STAGE_STARTED`, `STAGE_SUCCEEDED`,
  `STAGE_FAILED`, `STAGE_RETRIED`, `FAILURE_INJECTED`, `PRIORITY_ASSIGNED`,
  `ORDER_SCHEDULED`, `ORDER_ASSIGNED`, `ORDER_ACCEPTED`, `ORDER_REJECTED`,
  `CASE_CREATED`, `ORDER_DISPATCHED`, `ORDER_ARRIVED`, `ORDER_PROCESSING`,
  `ORDER_RESOLVED`, `ORDER_FAILED_TERMINAL`.
- `stage`: `INGEST`, `SCHEDULE`, `EXECUTE`, `RESOLVE`. `actor`: `SYSTEM`,
  `AGENT`, `ADMIN`.
- Payload fields the WBR relies on: `ORDER_CREATED.complaint_type`;
  `ORDER_REJECTED.reason_code` (`SERVICE_NOT_SUPPORTED`,
  `LOCATION_UNRESOLVED`, null before reason codes existed);
  `ORDER_SCHEDULED.operator_id`; `ORDER_RESOLVED.materials_cost_actual`.
  For any other field, read the event's producer in `backend/` first.
- **Rebuilds can duplicate rows:** dedupe on `(order_id, sequence_number)`
  before counting (`SELECT DISTINCT order_id, sequence_number, ...`).

### `order_snapshots`
The current projection per Order; **many rows per `order_id`**, so always take
the latest (idiom below).
`order_id`, `request_id`, `location_id`, `complaint_type`, `current_stage`,
`status`, `priority_tier`, `sla_deadline`, `scheduled_start`, `scheduled_end`,
`assigned_operator_id`, `reassignment_count` (bigint), `case_id`,
`estimated_materials_cost` / `actual_materials_cost` (double, null before
materials costs existed), `cost_model_used` (`BRUTE_FORCE`), `created_at`,
`updated_at`, `last_event_sequence` (bigint), `retry_counts` (JSON string),
`event_name` (`INSERT` | `MODIFY`, null on rebuild rows).
- `status` is only `CREATED`, `ACTIVE` or `REJECTED`. **There is no resolved
  status**: find resolved or failed Orders through `order_events`
  (`ORDER_RESOLVED`, `ORDER_FAILED_TERMINAL`) and join back on `order_id`.
- `priority_tier`: treat as an opaque string; group on it verbatim.

### `requests`
One row per NYC 311 Request. Not event-sourced; a re-delivered Request has
several rows, and the latest has the greatest `warehouse_ingested_at`.
`request_id`, `source` (`NYC_311`), `external_unique_key`, `location_id`
(nullable), `complaint_type`, `descriptor`, `agency`, `status`, `created_by`,
`created_at`, `raw_payload` (JSON string), `event_name`.
- `status`: `DRAFT`, `PENDING`, `PROMOTED`, `FILTERED`.

### `locations`
One row per Location; `location_id` = `bbl`.
`location_id`, `bbl`, `address`, `borough`, `community_board`, `zip`,
`latitude` / `longitude` (strings), `created_at`.
- `borough` is free text from the 311 feed (typically `MANHATTAN`,
  `BROOKLYN`, `QUEENS`, `BRONX`, `STATEN ISLAND`). Check with
  `SELECT DISTINCT borough` when exact values matter.

### `operator_events`
One row per Operator (vehicle) event: its whole working life.
`operator_id`, `sequence_number` (bigint), `event_type`, `occurred_at`,
`actor`, `payload` (JSON string).
- `event_type`: `OPERATOR_ADDED`, `OPERATOR_REMOVAL_REQUESTED`,
  `OPERATOR_REMOVED`, `TRANSIT_STARTED`, `WORK_STARTED`, `WORK_COMPLETED`,
  `WORK_ABORTED` (an execution failed mid-job; the vehicle goes back to idle
  where it is).
- `TRANSIT_STARTED`, `WORK_STARTED` and `WORK_COMPLETED` carry
  `$.order_id` in the payload (no typed column).
- An operator's activity follows its events: transit from
  `TRANSIT_STARTED`, working from `WORK_STARTED`, idle after
  `OPERATOR_ADDED`, `WORK_COMPLETED` or `WORK_ABORTED` until the next
  `TRANSIT_STARTED`. Ordered by `sequence_number` per `operator_id`
  (`LEAD`/`LAG`), the gaps between events give time spent in each activity.
- Dedupe on `(operator_id, sequence_number)` like `order_events`.

### `operator_snapshots`
The current projection per Operator; latest row per `operator_id` by
`last_event_sequence`.
`operator_id`, `name`, `status` (`ACTIVE`, `INACTIVE`), `current_activity`
(`IDLE`, `TRANSIT`, `WORKING`), `removal_requested_at`, `start_datetime`,
`end_datetime` (null while active), `rate_per_hour` (double),
`current_location` (JSON string), `last_event_sequence`, `added_by`,
`released_at`, `released_by` (who changed the fleet: an agent email or the
admin).
- An operator is paid `rate_per_hour` for its whole life, from
  `start_datetime` to `end_datetime` (or now), whatever it's doing.

### `public_api_calls`
One row per call to the public API (`public-api.boroughsim.com/v1/`).
`call_id`, `requester`, `operation`, `route_key`, `status_code` (bigint),
`outcome`, `latency_ms` (bigint), `request_params` (JSON string),
`result_count` (bigint), `resource_id`, `occurred_at`.
- `operation`: `SEARCH_REQUESTS`, `CREATE_FEATURE_REQUEST`,
  `GET_FEATURE_REQUEST`, `GET_OPENAPI_SPEC`, `UNKNOWN`. `outcome`: `SUCCESS`,
  `CLIENT_ERROR`, `SERVER_ERROR`. `requester` is `UNKNOWN` when missing.

### Not warehoused
`Case`, `Shift`, `User` and Contacts have no table. No shift concept exists
in the Operator model today; an operator's lifetime is its paid window. Say
so when a question needs one of these rather than inventing a table.

## How the WBR defines its numbers (`docs/v1-wbr.sql`)

- Weeks are `date_trunc('week', ...)` (ISO weeks, Monday start).
- `orders_created`: distinct `ORDER_CREATED` orders, all complaint types.
  Most are rejected `SERVICE_NOT_SUPPORTED`: only Street Condition orders are
  served.
- `orders_accepted`: distinct `ORDER_ACCEPTED` orders.
- **`total_cost`** is labor plus materials **for orders resolved that week**:
  labor = hours from the order's last `ORDER_SCHEDULED` to `ORDER_RESOLVED`
  × the scheduled operator's `rate_per_hour`. **Paid time not tied to an
  order (an idle operator) is not in it.**
- **Cost per accepted order** = `total_cost / orders_accepted` for the week.
- `median_resolution_hours`: created → resolved, for orders resolved that
  week.
- `operators_live`: operators whose paid window overlaps the week.

## Idioms

**Latest snapshot per id**
```sql
SELECT * FROM (
  SELECT s.*, ROW_NUMBER() OVER (PARTITION BY s.order_id ORDER BY s.last_event_sequence DESC) AS rn
  FROM order_snapshots s
) t
WHERE rn = 1
```
Same for `operator_snapshots` (`operator_id`). For `requests`, order by
`warehouse_ingested_at DESC`.

**Timestamps are strings:** `from_iso8601_timestamp(occurred_at)`; for a
date, `date(substr(occurred_at, 1, 10))`. Durations:
`date_diff('second', from_iso8601_timestamp(a), from_iso8601_timestamp(b)) / 3600.0`.

**Windows:** filter on the business timestamp,
`from_iso8601_timestamp(occurred_at) >= current_timestamp - INTERVAL '28' DAY`.
Add a `dt` predicate only to cut scan cost, and only when it can't drop a
rebuilt row you need.

**Order → borough:** `LEFT JOIN locations l ON l.location_id = s.location_id`,
`COALESCE(l.borough, 'UNKNOWN')`.

**JSON:** `json_extract_scalar(payload, '$.field')` for a scalar,
`try_cast(... AS double)` for a number.

**Default breakdowns** when a question says "by X" without naming it:
complaint type and borough.
