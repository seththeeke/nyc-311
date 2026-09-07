-- 7-data-warehousing.md §8 — count of Orders per borough, the payoff of
-- warehousing Locations. Latest order_snapshots row per order_id, joined
-- to the latest locations row per location_id (= bbl). Orders whose
-- Request never resolved a bbl, or whose Location has no borough, land in
-- 'UNKNOWN' rather than being dropped. Emits (borough, order_count).
WITH latest_order AS (
  SELECT
    order_id,
    location_id,
    ROW_NUMBER() OVER (PARTITION BY order_id ORDER BY warehouse_ingested_at DESC) AS rn
  FROM order_snapshots
),
latest_location AS (
  SELECT
    location_id,
    borough,
    ROW_NUMBER() OVER (PARTITION BY location_id ORDER BY warehouse_ingested_at DESC) AS rn
  FROM locations
)
SELECT
  COALESCE(l.borough, 'UNKNOWN') AS borough,
  CAST(COUNT(*) AS varchar) AS order_count
FROM latest_order o
LEFT JOIN latest_location l
  ON o.location_id = l.location_id AND l.rn = 1
WHERE o.rn = 1
GROUP BY COALESCE(l.borough, 'UNKNOWN')
ORDER BY borough
