import { z } from "zod";

/*
 * `GET /workspace/metrics` response — the secondary workspace's metric
 * tiles, shaped for the web-app so no report parsing happens client-side.
 * Each metric carries the latest week's value and the week before it (for
 * a week-over-week delta); `null` means the report has no value for it,
 * including when its column doesn't exist in the report yet.
 * The web-app mirrors this (`web-app/src/models/workspaceMetrics.ts`).
 */
export const WORKSPACE_METRIC_IDS = [
  "REQUESTS_ACCEPTED",
  "SERVICED",
  "MEAN_TIME_TO_RESOLVE_HOURS",
  "MEDIAN_TIME_TO_RESOLVE_HOURS",
  "TOTAL_COST",
] as const;
export type WorkspaceMetricId = (typeof WORKSPACE_METRIC_IDS)[number];

export const WorkspaceMetricValueSchema = z.object({
  current: z.number().nullable(),
  previous: z.number().nullable(),
});
export type WorkspaceMetricValue = z.infer<typeof WorkspaceMetricValueSchema>;

/* Where the values came from: the weekly `wbr` warehouse job, or the live week-to-date day buckets. */
export const WORKSPACE_METRICS_SOURCES = ["WBR", "LIVE"] as const;
export type WorkspaceMetricsSource = (typeof WORKSPACE_METRICS_SOURCES)[number];

export const WorkspaceMetricsSchema = z.object({
  source: z.enum(WORKSPACE_METRICS_SOURCES),
  /** The warehouse job the values come from; `"live"` when `source` is `LIVE`. */
  source_job: z.string().min(1),
  /** `null` until that job has produced a result. */
  job_run_id: z.string().nullable(),
  computed_at: z.string().nullable(),
  week_start: z.string().nullable(),
  previous_week_start: z.string().nullable(),
  metrics: z.object({
    REQUESTS_ACCEPTED: WorkspaceMetricValueSchema,
    SERVICED: WorkspaceMetricValueSchema,
    MEAN_TIME_TO_RESOLVE_HOURS: WorkspaceMetricValueSchema,
    MEDIAN_TIME_TO_RESOLVE_HOURS: WorkspaceMetricValueSchema,
    TOTAL_COST: WorkspaceMetricValueSchema,
  }),
});
export type WorkspaceMetrics = z.infer<typeof WorkspaceMetricsSchema>;
