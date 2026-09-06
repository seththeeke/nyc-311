import { z } from "zod";

/*
 * Mirrors backend/models/analyticsRollup.ts (7-data-warehousing.md §11) —
 * one pre-aggregated result row from the AnalyticsRollups table, as returned
 * by GET /data/rollups. `metric_view` is the partition key, `rollup_key`
 * (`<run_date>#<dimension>`) the sort key, so one view holds a daily time
 * series across dimensions. Every service response is parsed through this
 * schema before it reaches a component (CLAUDE.md §5.1's network-boundary
 * rule).
 */
export const AnalyticsRollupSchema = z.object({
  metric_view: z.string().min(1),
  rollup_key: z.string().min(1),
  run_date: z.string().min(1),
  dimension: z.string().min(1),
  value: z.number(),
  computed_at: z.string().min(1),
  job_run_id: z.string().min(1),
});
export type AnalyticsRollup = z.infer<typeof AnalyticsRollupSchema>;

export const AnalyticsRollupListResponseSchema = z.object({
  rollups: z.array(AnalyticsRollupSchema),
});
export type AnalyticsRollupListResponse = z.infer<typeof AnalyticsRollupListResponseSchema>;
