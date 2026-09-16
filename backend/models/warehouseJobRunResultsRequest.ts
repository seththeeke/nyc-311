import { z } from "zod";

/*
 * POST /admin/warehouse/job-runs/results's request body
 * (7-data-warehousing.md §12b's Reports tab addition) — a batch of run
 * ids, admin-only. Bulk from the start so the same endpoint can back a
 * future multi-report dashboard without a breaking change.
 */

/** A sane cap for a dashboard-sized batch, not a hard product requirement. */
export const MAX_JOB_RUN_IDS_PER_REQUEST = 25;

export const JobRunResultsRequestSchema = z.object({
  job_run_ids: z.array(z.string().min(1)).min(1).max(MAX_JOB_RUN_IDS_PER_REQUEST),
});
export type JobRunResultsRequest = z.infer<typeof JobRunResultsRequestSchema>;
