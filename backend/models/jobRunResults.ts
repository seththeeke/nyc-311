import { z } from "zod";
import { JobResultSchema } from "./jobResult";

/*
 * The response envelope for POST /admin/warehouse/job-runs/results
 * (7-data-warehousing.md §12b's Reports tab addition) — one item per
 * requested job_run_id, resolved independently, so a dashboard can render
 * the runs that succeeded even if others have no result yet or failed to
 * load. Exactly one of `result`/`error` is set per item.
 */
export const JobRunResultItemSchema = z.object({
  job_run_id: z.string().min(1),
  result: JobResultSchema.nullable(),
  error: z.string().nullable(),
});
export type JobRunResultItem = z.infer<typeof JobRunResultItemSchema>;

export const JobRunResultsResponseSchema = z.object({
  results: z.array(JobRunResultItemSchema),
});
export type JobRunResultsResponse = z.infer<typeof JobRunResultsResponseSchema>;
