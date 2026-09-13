import { z } from "zod";

/*
 * The response envelope for POST /admin/warehouse/query
 * (7-data-warehousing.md §12a, Leg 7) — the same columns/rows shape as
 * models/jobResult.ts's §11 envelope (string-valued rows, Athena types),
 * without literally being a job result (no job_name/run_date/job_run_id).
 * `row_count`/`truncated` reflect GetQueryResults' 500-row cap; the two
 * nullable stats mirror WarehouseJobRun's Athena-metrics fields.
 */
export const AdHocQueryResultSchema = z.object({
  columns: z.array(z.object({ name: z.string().min(1), type: z.string().min(1) })),
  rows: z.array(z.record(z.string(), z.string())),
  row_count: z.number().int().nonnegative(),
  truncated: z.boolean(),
  data_scanned_bytes: z.number().int().nonnegative().nullable(),
  engine_execution_time_ms: z.number().int().nonnegative().nullable(),
});
export type AdHocQueryResult = z.infer<typeof AdHocQueryResultSchema>;
