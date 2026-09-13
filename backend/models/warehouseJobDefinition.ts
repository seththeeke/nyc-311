import { z } from "zod";
import { WAREHOUSE_JOB_NAME_REGEX } from "./warehouseJob";

/*
 * A self-service job definition (`7-data-warehousing.md` §8, Leg 8) — a
 * second item type sharing the `WarehouseJobRuns` table with run rows
 * (models/warehouseJobRun.ts), discriminated by `record_type` and by
 * `job_run_id`'s shape (`DEF#<name>` here, a ULID for a run). Points at
 * the job's SQL in S3 rather than storing it inline, and at the
 * EventBridge Scheduler schedule that fires it.
 */
export const DEFINITIONS_GSI1_PK = "JOB#DEFINITIONS";

export const WarehouseJobDefinitionSchema = z.object({
  job_run_id: z.string().min(1),
  record_type: z.literal("DEFINITION"),
  job_name: z.string().min(1).regex(WAREHOUSE_JOB_NAME_REGEX, "job name must be lower_snake_case (S3 partition-safe)"),
  sql_s3_key: z.string().min(1),
  cadence_cron: z.string().min(1),
  schedule_name: z.string().min(1),
  created_at: z.string().min(1),
  created_by: z.string().min(1),
});
export type WarehouseJobDefinition = z.infer<typeof WarehouseJobDefinitionSchema>;

/** `WarehouseJobRuns.job_run_id` for a job named `name`'s definition row. */
export function warehouseJobDefinitionId(name: string): string {
  return `DEF#${name}`;
}

export const WarehouseJobDefinitionListResponseSchema = z.object({
  jobs: z.array(WarehouseJobDefinitionSchema),
});
export type WarehouseJobDefinitionListResponse = z.infer<typeof WarehouseJobDefinitionListResponseSchema>;
