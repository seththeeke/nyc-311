import { z } from "zod";

/*
 * Mirrors backend/models/report.ts (7-data-warehousing.md §12) — the
 * business-facing reporting surface returned by GET /reports. Each report
 * is one warehouse job's latest resultset, reshaped into a week-over-week
 * trend: ordered week buckets, each holding a numeric value per series
 * (e.g. per stage). Every service response is parsed through this schema
 * before it reaches a component (CLAUDE.md §5.1).
 */
export const ReportWeekSchema = z.object({
  week: z.string().min(1),
  values: z.record(z.string(), z.number()),
});
export type ReportWeek = z.infer<typeof ReportWeekSchema>;

export const ReportSchema = z.object({
  job_name: z.string().min(1),
  title: z.string().min(1),
  run_date: z.string().min(1),
  computed_at: z.string().min(1),
  week_column: z.string().min(1),
  series_column: z.string().min(1),
  value_column: z.string().min(1),
  series: z.array(z.string()),
  weeks: z.array(ReportWeekSchema),
});
export type Report = z.infer<typeof ReportSchema>;

export const ReportsResponseSchema = z.object({
  reports: z.array(ReportSchema),
});
export type ReportsResponse = z.infer<typeof ReportsResponseSchema>;
