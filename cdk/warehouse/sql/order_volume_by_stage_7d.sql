-- 7-data-warehousing.md §8 — order volume by (created-date, current stage)
-- over the trailing 7 created-date buckets. From the latest order_snapshots
-- row per order_id (dedup by warehouse_ingested_at). Emits one row per
-- (created_date, stage); the runner stores the resultset verbatim as
-- job-results/job_name=order_volume_by_stage_7d/run_date=<date>/result.json
-- and it becomes one row of the job_results Glue table (§11).
WITH latest AS (
  SELECT
    order_id,
    current_stage,
    substr(created_at, 1, 10) AS created_date,
    ROW_NUMBER() OVER (PARTITION BY order_id ORDER BY warehouse_ingested_at DESC) AS rn
  FROM order_snapshots
)
SELECT
  created_date,
  current_stage AS stage,
  CAST(COUNT(*) AS varchar) AS order_count
FROM latest
WHERE rn = 1
  AND created_date >= date_format(date_add('day', -6, current_date), '%Y-%m-%d')
GROUP BY created_date, current_stage
ORDER BY created_date, current_stage
