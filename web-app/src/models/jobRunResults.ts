import { z } from "zod";
import { JobResultSchema } from "./jobResult";

/*
 * Mirrors backend/models/jobRunResults.ts (7-data-warehousing.md §12b's
 * Reports tab addition) — the response envelope for
 * POST /admin/warehouse/job-runs/results, one item per requested
 * job_run_id, resolved independently. Exactly one of `result`/`error` is
 * set per item, so a run with no result yet (or a failed fetch) can
 * render its own message without blanking the rest of a batch.
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
