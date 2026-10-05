import { z } from "zod";

/*
 * Mirrors backend/models/workspaceMetrics.ts — `GET /workspace/metrics`,
 * the secondary workspace's metric tiles. Each metric is the latest
 * week's value plus the week before (for a week-over-week delta); `null`
 * means the source report has no value. Parsed at the service boundary
 * (CLAUDE.md §5.1).
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

/*
 * Where the values came from: the weekly `wbr` warehouse job, or the live
 * week-to-date day buckets (week = Monday through today, New York time;
 * `previous` = the same days of the week before). Defaults to WBR so a
 * response from an API that predates this field still parses.
 */
export const WORKSPACE_METRICS_SOURCES = ["WBR", "LIVE"] as const;
export type WorkspaceMetricsSource = (typeof WORKSPACE_METRICS_SOURCES)[number];

export const WorkspaceMetricsSchema = z.object({
  source: z.enum(WORKSPACE_METRICS_SOURCES).default("WBR"),
  source_job: z.string().min(1),
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
