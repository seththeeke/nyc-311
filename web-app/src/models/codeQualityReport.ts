import { z } from "zod";

/*
 * Mirrors backend/models/codeQualityReport.ts: Sable's code-quality reports
 * (docs/17-executive-team.md §19.6). A report's date and time are its run's
 * start in CT; its score is out of 100, null when the report had none.
 */

export const CodeQualityReportSummarySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^[0-2]\d_[0-5]\d$/),
  package: z.string().min(1),
  score: z.number().int().min(0).max(100).nullable(),
  previous: z.number().int().min(0).max(100).nullable(),
});
export type CodeQualityReportSummary = z.infer<typeof CodeQualityReportSummarySchema>;

export const CodeQualityReportListSchema = z.object({ reports: z.array(CodeQualityReportSummarySchema) });

export const CodeQualityReportSchema = CodeQualityReportSummarySchema.extend({ markdown: z.string() });
export type CodeQualityReport = z.infer<typeof CodeQualityReportSchema>;
