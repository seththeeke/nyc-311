import { z } from "zod";

/*
 * `GET /workspace/metrics` response — the secondary workspace's metric
 * tiles, from the live day buckets: this New York week to date against
 * the same days of the week before. `null` means no value (e.g. no
 * resolutions yet, or no buckets for the previous week). The web-app
 * mirrors this (`web-app/src/models/workspaceMetrics.ts`).
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

export const WorkspaceMetricsSchema = z.object({
  computed_at: z.string().min(1),
  /** Monday of the current New York week, `YYYY-MM-DD`. */
  week_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  previous_week_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  metrics: z.object({
    REQUESTS_ACCEPTED: WorkspaceMetricValueSchema,
    SERVICED: WorkspaceMetricValueSchema,
    MEAN_TIME_TO_RESOLVE_HOURS: WorkspaceMetricValueSchema,
    MEDIAN_TIME_TO_RESOLVE_HOURS: WorkspaceMetricValueSchema,
    TOTAL_COST: WorkspaceMetricValueSchema,
  }),
});
export type WorkspaceMetrics = z.infer<typeof WorkspaceMetricsSchema>;
