-- 7-data-warehousing.md §8/§12 — order volume by (creation-week, current
-- stage) over the trailing ~8 ISO weeks. The week bucketing is done here in
-- SQL, so every daily run recomputes all 8 weeks with *current* stages and
-- the latest result.json is a complete week-over-week trend. This is what
-- GET /reports reads (materialized, no Athena on the read path). From the
-- latest order_snapshots row per order_id; a row whose created_at doesn't
-- parse to a date is dropped rather than failing the query.
WITH latest AS (
  SELECT
    order_id,
    current_stage,
    try(date_trunc('week', date(substr(created_at, 1, 10)))) AS created_week,
    ROW_NUMBER() OVER (PARTITION BY order_id ORDER BY warehouse_ingested_at DESC) AS rn
  FROM order_snapshots
)
SELECT
  date_format(created_week, '%Y-%m-%d') AS week_start,
  current_stage AS stage,
  CAST(COUNT(*) AS varchar) AS order_count
FROM latest
WHERE rn = 1
  AND created_week IS NOT NULL
  AND created_week >= date_trunc('week', current_date - interval '55' day)
GROUP BY date_format(created_week, '%Y-%m-%d'), current_stage
ORDER BY week_start, stage
