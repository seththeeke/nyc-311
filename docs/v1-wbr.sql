-- v1 `wbr` (weekly business review) job — v1-prod-deployment.md F8.
-- Applied by hand as the `wbr` warehouse job in Test, then Prod (identical SQL).
-- One row per ISO week, trailing 12 weeks. Every value is a varchar (job results
-- are stored as strings). The workspace tiles read these columns by name
-- (backend/service/analytics/workspaceMetricsService.ts METRIC_COLUMNS):
-- orders_accepted, orders_resolved, avg_resolution_hours,
-- median_resolution_hours, total_cost. Don't rename them.
--
-- Rules this follows:
-- * Counts come from order_events (append-only), never COUNT(*) on
--   order_snapshots, which has one row per projection change (B12).
-- * order_events can hold rebuild-replay duplicates, so `events` dedups on
--   (order_id, sequence_number) first.
-- * "Latest snapshot per entity" dedups on last_event_sequence (#40).
-- * Funnel (Q2): Street Condition Orders created / accepted / rejected by
--   reason_code. Rejections from before reason codes existed (pre-F4) land
--   in orders_rejected_other.
-- * Failures (Q3/F6): STAGE_FAILED events. execution_failure_rate =
--   failures / (failures + resolutions) in the week.
-- * Cost (Q5/F5) for Orders resolved in the week: labor = hours from the
--   Order's last ORDER_SCHEDULED to ORDER_RESOLVED x that vehicle's
--   rate_per_hour; materials = ORDER_RESOLVED's materials_cost_actual (0
--   before F5). total_cost = labor + materials. Idle fleet time isn't a job
--   cost, so it isn't counted here.
WITH
events AS (
  SELECT DISTINCT order_id, sequence_number, event_type, occurred_at, payload
  FROM order_events
),
weekly_events AS (
  SELECT
    e.*,
    try(date_trunc('week', date(substr(e.occurred_at, 1, 10)))) AS week_start
  FROM events e
),
created AS (
  SELECT
    week_start,
    COUNT(DISTINCT order_id) AS orders_created,
    COUNT(DISTINCT CASE WHEN json_extract_scalar(payload, '$.complaint_type') = 'Street Condition' THEN order_id END)
      AS street_condition_created
  FROM weekly_events
  WHERE event_type = 'ORDER_CREATED'
  GROUP BY week_start
),
accepted AS (
  SELECT week_start, COUNT(DISTINCT order_id) AS orders_accepted
  FROM weekly_events
  WHERE event_type = 'ORDER_ACCEPTED'
  GROUP BY week_start
),
rejected AS (
  SELECT
    week_start,
    COUNT(DISTINCT order_id) AS orders_rejected,
    COUNT(DISTINCT CASE WHEN json_extract_scalar(payload, '$.reason_code') = 'SERVICE_NOT_SUPPORTED' THEN order_id END)
      AS rejected_service_not_supported,
    COUNT(DISTINCT CASE WHEN json_extract_scalar(payload, '$.reason_code') = 'LOCATION_UNRESOLVED' THEN order_id END)
      AS rejected_location_unresolved,
    COUNT(DISTINCT CASE WHEN json_extract_scalar(payload, '$.reason_code') IS NULL THEN order_id END)
      AS rejected_other
  FROM weekly_events
  WHERE event_type = 'ORDER_REJECTED'
  GROUP BY week_start
),
failures AS (
  SELECT
    week_start,
    COUNT(*) AS execution_failures,
    COUNT(DISTINCT order_id) AS orders_with_failures
  FROM weekly_events
  WHERE event_type = 'STAGE_FAILED'
  GROUP BY week_start
),
created_ts AS (
  SELECT order_id, MIN(occurred_at) AS created_at
  FROM events
  WHERE event_type = 'ORDER_CREATED'
  GROUP BY order_id
),
resolved_ev AS (
  SELECT order_id, occurred_at AS resolved_at, payload
  FROM (
    SELECT
      order_id, occurred_at, payload,
      ROW_NUMBER() OVER (PARTITION BY order_id ORDER BY sequence_number) AS rn
    FROM events
    WHERE event_type = 'ORDER_RESOLVED'
  ) t
  WHERE rn = 1
),
last_scheduled AS (
  SELECT order_id, occurred_at AS scheduled_at, json_extract_scalar(payload, '$.operator_id') AS operator_id
  FROM (
    SELECT
      order_id, occurred_at, payload,
      ROW_NUMBER() OVER (PARTITION BY order_id ORDER BY sequence_number DESC) AS rn
    FROM events
    WHERE event_type = 'ORDER_SCHEDULED'
  ) t
  WHERE rn = 1
),
operator_latest AS (
  SELECT *
  FROM (
    SELECT
      o.*,
      ROW_NUMBER() OVER (PARTITION BY o.operator_id ORDER BY o.last_event_sequence DESC, o.warehouse_ingested_at DESC) AS rn
    FROM operator_snapshots o
  ) t
  WHERE rn = 1
),
resolved_jobs AS (
  SELECT
    try(date_trunc('week', date(substr(r.resolved_at, 1, 10)))) AS resolved_week,
    date_diff('second', from_iso8601_timestamp(c.created_at), from_iso8601_timestamp(r.resolved_at)) / 3600.0
      AS resolution_hours,
    COALESCE(
      date_diff('second', from_iso8601_timestamp(s.scheduled_at), from_iso8601_timestamp(r.resolved_at)) / 3600.0
        * op.rate_per_hour,
      0
    ) AS labor_cost,
    COALESCE(try_cast(json_extract_scalar(r.payload, '$.materials_cost_actual') AS double), 0) AS materials_cost
  FROM resolved_ev r
  JOIN created_ts c ON c.order_id = r.order_id
  LEFT JOIN last_scheduled s ON s.order_id = r.order_id
  LEFT JOIN operator_latest op ON op.operator_id = s.operator_id
),
resolution_stats AS (
  SELECT
    resolved_week,
    COUNT(*) AS orders_resolved,
    ROUND(AVG(resolution_hours), 2) AS avg_resolution_hours,
    ROUND(approx_percentile(resolution_hours, 0.5), 2) AS median_resolution_hours,
    ROUND(SUM(labor_cost), 2) AS labor_cost,
    ROUND(SUM(materials_cost), 2) AS materials_cost,
    ROUND(SUM(labor_cost) + SUM(materials_cost), 2) AS total_cost
  FROM resolved_jobs
  WHERE resolved_week IS NOT NULL
  GROUP BY resolved_week
),
weeks AS (
  SELECT week_start FROM weekly_events WHERE week_start IS NOT NULL
  UNION
  SELECT resolved_week FROM resolution_stats
),
-- "Operators live during the week": latest snapshot per operator whose
-- [start_datetime, end_datetime] overlaps the week (end NULL = still active).
-- Shift isn't warehoused, so lifecycle windows are the best available proxy.
capacity_counts AS (
  SELECT w.week_start, COUNT(*) AS operators_live
  FROM weeks w
  CROSS JOIN operator_latest o
  WHERE date(from_iso8601_timestamp(o.start_datetime)) < w.week_start + INTERVAL '7' DAY
    AND (o.end_datetime IS NULL OR date(from_iso8601_timestamp(o.end_datetime)) >= w.week_start)
  GROUP BY w.week_start
)
SELECT
  date_format(w.week_start, '%Y-%m-%d') AS week_start,
  CAST(COALESCE(c.orders_created, 0) AS varchar) AS orders_created,
  CAST(COALESCE(c.street_condition_created, 0) AS varchar) AS street_condition_created,
  CAST(COALESCE(a.orders_accepted, 0) AS varchar) AS orders_accepted,
  CAST(COALESCE(rj.orders_rejected, 0) AS varchar) AS orders_rejected,
  CAST(COALESCE(rj.rejected_service_not_supported, 0) AS varchar) AS rejected_service_not_supported,
  CAST(COALESCE(rj.rejected_location_unresolved, 0) AS varchar) AS rejected_location_unresolved,
  CAST(COALESCE(rj.rejected_other, 0) AS varchar) AS rejected_other,
  CAST(
    ROUND(CAST(COALESCE(rj.rejected_location_unresolved, 0) AS double) / NULLIF(c.street_condition_created, 0), 4)
    AS varchar
  ) AS location_unresolved_rate,
  CAST(COALESCE(r.orders_resolved, 0) AS varchar) AS orders_resolved,
  CAST(r.avg_resolution_hours AS varchar) AS avg_resolution_hours,
  CAST(r.median_resolution_hours AS varchar) AS median_resolution_hours,
  CAST(COALESCE(f.execution_failures, 0) AS varchar) AS execution_failures,
  CAST(COALESCE(f.orders_with_failures, 0) AS varchar) AS orders_with_failures,
  CAST(
    ROUND(
      CAST(COALESCE(f.execution_failures, 0) AS double)
        / NULLIF(COALESCE(f.execution_failures, 0) + COALESCE(r.orders_resolved, 0), 0),
      4
    ) AS varchar
  ) AS execution_failure_rate,
  CAST(COALESCE(r.labor_cost, 0) AS varchar) AS labor_cost,
  CAST(COALESCE(r.materials_cost, 0) AS varchar) AS materials_cost,
  CAST(COALESCE(r.total_cost, 0) AS varchar) AS total_cost,
  CAST(COALESCE(cap.operators_live, 0) AS varchar) AS operators_live
FROM weeks w
LEFT JOIN created c ON c.week_start = w.week_start
LEFT JOIN accepted a ON a.week_start = w.week_start
LEFT JOIN rejected rj ON rj.week_start = w.week_start
LEFT JOIN failures f ON f.week_start = w.week_start
LEFT JOIN resolution_stats r ON r.resolved_week = w.week_start
LEFT JOIN capacity_counts cap ON cap.week_start = w.week_start
WHERE w.week_start >= date_trunc('week', current_date - INTERVAL '83' DAY)
ORDER BY week_start
