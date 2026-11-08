import { z } from "zod";

/*
 * Sable's code-quality reports (docs/17-executive-team.md §19.6), read from
 * the agents' reports bucket. A report's folder is its run's start in CT:
 * <YYYY-MM-DD>/<HH_MM>. Its front matter carries the package and scores.
 */

export const CODE_QUALITY_REPORT_DATE = /^\d{4}-\d{2}-\d{2}$/;
export const CODE_QUALITY_REPORT_TIME = /^[0-2]\d_[0-5]\d$/;

export const CodeQualityReportParamsSchema = z.object({
  date: z.string().regex(CODE_QUALITY_REPORT_DATE),
  time: z.string().regex(CODE_QUALITY_REPORT_TIME),
});
export type CodeQualityReportParams = z.infer<typeof CodeQualityReportParamsSchema>;

/** One report in the list: where it is and what it scored, without its text. */
export const CodeQualityReportSummarySchema = z.object({
  date: z.string().regex(CODE_QUALITY_REPORT_DATE),
  time: z.string().regex(CODE_QUALITY_REPORT_TIME),
  package: z.string().min(1),
  score: z.number().int().min(0).max(100).nullable(),
  previous: z.number().int().min(0).max(100).nullable(),
});
export type CodeQualityReportSummary = z.infer<typeof CodeQualityReportSummarySchema>;

/** One report with its Markdown, front matter removed. */
export const CodeQualityReportSchema = CodeQualityReportSummarySchema.extend({
  markdown: z.string(),
});
export type CodeQualityReport = z.infer<typeof CodeQualityReportSchema>;
