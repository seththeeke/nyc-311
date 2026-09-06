-- 7-data-warehousing.md §1/§7 — the sample job. Count of Orders per
-- current_stage, from the latest order_snapshots row per order_id
-- (dedup by warehouse_ingested_at). Emits (dimension, value) rows the
-- copy-back Lambda folds into AnalyticsRollups under
-- metric_view = 'ORDER_VOLUME_BY_STAGE'.
WITH latest AS (
  SELECT
    order_id,
    current_stage,
    ROW_NUMBER() OVER (PARTITION BY order_id ORDER BY warehouse_ingested_at DESC) AS rn
  FROM order_snapshots
)
SELECT
  current_stage AS dimension,
  CAST(COUNT(*) AS varchar) AS value
FROM latest
WHERE rn = 1
GROUP BY current_stage
ORDER BY current_stage
