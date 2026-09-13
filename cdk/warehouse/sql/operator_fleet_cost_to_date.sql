-- 7-data-warehousing.md §8 (Leg 6) — 10-capacity-modeling-and-integration.md
-- §2.3's "all-time accumulated cost": rate_per_hour x hours elapsed from
-- start_datetime to end_datetime (or now, for a still-active Operator).
-- One row per Operator ever added, from the latest operator_snapshots row
-- per operator_id (dedup by warehouse_ingested_at), ordered by cost
-- descending. Emits (operator_id, name, rate_per_hour, accumulated_cost).
WITH latest_operator AS (
  SELECT
    operator_id,
    name,
    rate_per_hour,
    start_datetime,
    end_datetime,
    ROW_NUMBER() OVER (PARTITION BY operator_id ORDER BY warehouse_ingested_at DESC) AS rn
  FROM operator_snapshots
),
cost AS (
  SELECT
    operator_id,
    name,
    rate_per_hour,
    ROUND(
      date_diff(
        'second',
        from_iso8601_timestamp(start_datetime),
        COALESCE(from_iso8601_timestamp(end_datetime), current_timestamp)
      ) / 3600.0 * rate_per_hour,
      2
    ) AS accumulated_cost
  FROM latest_operator
  WHERE rn = 1
)
SELECT
  operator_id,
  name,
  CAST(rate_per_hour AS varchar) AS rate_per_hour,
  CAST(accumulated_cost AS varchar) AS accumulated_cost
FROM cost
ORDER BY accumulated_cost DESC
