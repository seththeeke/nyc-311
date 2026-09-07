import { z } from "zod";

/*
 * `GET /reports` (`7-data-warehousing.md` §12) — the business-facing
 * reporting surface. Each report is one job's latest resultset,
 * reshaped into a week-over-week trend: an ordered list of week buckets,
 * each holding a value per series (e.g. per stage). The reports service
 * assembles this from the materialized `result.json` in S3 — no Athena on
 * the read path. Every response is parsed through this schema at the
 * network boundary; the web-app mirrors it (`web-app/src/models/report.ts`).
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
  /** The resultset column names this trend was built from. */
  week_column: z.string().min(1),
  series_column: z.string().min(1),
  value_column: z.string().min(1),
  /** Distinct series values (e.g. stages), sorted — the chart's legend / stack order. */
  series: z.array(z.string()),
  /** Week buckets, oldest first. `values` omits a series with no rows that week. */
  weeks: z.array(ReportWeekSchema),
});
export type Report = z.infer<typeof ReportSchema>;

export const ReportsResponseSchema = z.object({
  reports: z.array(ReportSchema),
});
export type ReportsResponse = z.infer<typeof ReportsResponseSchema>;
