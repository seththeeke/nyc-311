import { z } from "zod";

/*
 * The live (week-to-date) source for the secondary workspace's metric
 * tiles — one small item per New York calendar day in the
 * LiveWorkspaceMetrics table, incremented as Orders are accepted and
 * resolved. Not a data-model.md entity; analytics bookkeeping, like
 * warehouseJobRun.ts.
 */

/** Feature flag choosing the tiles' source. Remove with the WBR read path once T1 is permanent. */
export const LIVE_METRICS_FLAG_KEY = "LIVE_METRICS_DASHBOARD";
/** Control: tiles read the latest `wbr` warehouse job run (the pre-flag behavior). */
export const LIVE_METRICS_CONTROL_TREATMENT = "C";
/** Treatment 1: tiles read the live day buckets. */
export const LIVE_METRICS_LIVE_TREATMENT = "T1";

/* The week boundary: Monday 00:00 in this zone, i.e. the midnight that ends Sunday. */
export const LIVE_METRICS_TIME_ZONE = "America/New_York";

export const DAY_BUCKET_KEY_PREFIX = "DAY#";

/** The partition key of one day's bucket, `day` being a `YYYY-MM-DD` New York date. */
export function dayBucketKey(day: string): string {
  return `${DAY_BUCKET_KEY_PREFIX}${day}`;
}

/*
 * Counters are optional because each is created by the first `ADD` that
 * touches it — a day with acceptances but no resolutions yet has no
 * resolved_* attributes at all.
 */
export const LiveMetricsDayBucketSchema = z.object({
  metric_key: z.string().startsWith(DAY_BUCKET_KEY_PREFIX),
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  accepted_count: z.number().int().nonnegative().optional(),
  resolved_count: z.number().int().nonnegative().optional(),
  resolution_seconds_sum: z.number().nonnegative().optional(),
  total_cost_sum: z.number().nonnegative().optional(),
  /* Every resolution time that day, kept whole so the median is exact rather than bucketed. */
  resolution_seconds: z.array(z.number().nonnegative()).optional(),
  updated_at: z.string().min(1),
});
export type LiveMetricsDayBucket = z.infer<typeof LiveMetricsDayBucketSchema>;
