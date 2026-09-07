import { z } from "zod";

/*
 * One row of the WarehouseJobRuns table (`7-data-warehousing.md` §9) —
 * the daily aggregation jobs, their bounded automatic retries, and
 * (later) the on-demand rebuild, all one shape. The run row is the index
 * into the job's output: `result_location` points at the immutable
 * `result.json` in S3 (§11). The web-app mirrors this exactly
 * (`web-app/src/models/warehouseJobRun.ts`).
 */

export const WAREHOUSE_JOB_RUN_STATUSES = ["RUNNING", "SUCCEEDED", "FAILED"] as const;
export type WarehouseJobRunStatus = (typeof WAREHOUSE_JOB_RUN_STATUSES)[number];

export const WAREHOUSE_JOB_RUN_TRIGGERS = ["SCHEDULED", "RETRY", "MANUAL"] as const;
export type WarehouseJobRunTrigger = (typeof WAREHOUSE_JOB_RUN_TRIGGERS)[number];

/** §9's bounded automatic-retry cutoff — a FAILED run at this retry_count stops being retried. */
export const MAX_JOB_RETRIES = 3;

/** Fixed partition key for the "recent runs" GSI — every job run row sets it. */
export const JOB_RUNS_GSI1_PK = "JOB#RUNS";

export const WarehouseJobRunSchema = z.object({
  job_run_id: z.string().min(1),
  job_name: z.string().min(1),
  status: z.enum(WAREHOUSE_JOB_RUN_STATUSES),
  trigger: z.enum(WAREHOUSE_JOB_RUN_TRIGGERS),
  started_at: z.string().min(1),
  completed_at: z.string().min(1).nullable(),
  execution_ref: z.string().min(1).nullable(),
  /** `s3://…/job-results/job_name=<job>/run_date=<date>/result.json` — null while RUNNING and for runs that produce no resultset. */
  result_location: z.string().min(1).nullable(),
  /** Rows in the resultset; null while RUNNING / for resultless runs. */
  row_count: z.number().int().nonnegative().nullable(),
  error_message: z.string().min(1).nullable(),
  retry_count: z.number().int().nonnegative(),
  retried_from_job_run_id: z.string().min(1).nullable(),
  data_scanned_bytes: z.number().nonnegative().nullable(),
  engine_execution_time_ms: z.number().nonnegative().nullable(),
  query_queue_time_ms: z.number().nonnegative().nullable(),
});
export type WarehouseJobRun = z.infer<typeof WarehouseJobRunSchema>;

export const WarehouseJobRunListResponseSchema = z.object({
  jobRuns: z.array(WarehouseJobRunSchema),
});
export type WarehouseJobRunListResponse = z.infer<typeof WarehouseJobRunListResponseSchema>;
