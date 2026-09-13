import { z } from "zod";

/*
 * Mirrors backend/models/adHocQueryResult.ts (7-data-warehousing.md
 * §12a) — the response of POST /admin/warehouse/query. Same columns/rows
 * shape as models/jobResult.ts, without job_name/run_date/job_run_id
 * (this isn't a job run). Every service response is parsed through this
 * schema before it reaches a component (CLAUDE.md §5.1).
 */
export const AdHocQueryResultColumnSchema = z.object({
  name: z.string().min(1),
  type: z.string().min(1),
});
export type AdHocQueryResultColumn = z.infer<typeof AdHocQueryResultColumnSchema>;

export const AdHocQueryResultSchema = z.object({
  columns: z.array(AdHocQueryResultColumnSchema),
  rows: z.array(z.record(z.string(), z.string())),
  row_count: z.number().int().nonnegative(),
  truncated: z.boolean(),
  data_scanned_bytes: z.number().int().nonnegative().nullable(),
  engine_execution_time_ms: z.number().int().nonnegative().nullable(),
});
export type AdHocQueryResult = z.infer<typeof AdHocQueryResultSchema>;
