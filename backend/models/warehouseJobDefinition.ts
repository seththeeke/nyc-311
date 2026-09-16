import { z } from "zod";
import { WAREHOUSE_JOB_NAME_REGEX, WAREHOUSE_JOB_TYPES } from "./warehouseJob";

/*
 * A self-service job definition (`7-data-warehousing.md` §8, Leg 8) — a
 * second item type sharing the `WarehouseJobRuns` table with run rows
 * (models/warehouseJobRun.ts), discriminated by `record_type` and
 * `job_run_id`'s shape (`DEF#<name>`, vs. a ULID for a run). Points at the
 * job's SQL in S3. `cadence_cron`/`schedule_name` are set only for
 * `SCHEDULED` rows — `job_type` defaults to `SCHEDULED` so pre-existing
 * rows keep resolving with no backfill.
 */
export const DEFINITIONS_GSI1_PK = "JOB#DEFINITIONS";

export const WarehouseJobDefinitionSchema = z.object({
  job_run_id: z.string().min(1),
  record_type: z.literal("DEFINITION"),
  job_name: z.string().min(1).regex(WAREHOUSE_JOB_NAME_REGEX, "job name must be lower_snake_case (S3 partition-safe)"),
  sql_s3_key: z.string().min(1),
  job_type: z.enum(WAREHOUSE_JOB_TYPES).default("SCHEDULED"),
  cadence_cron: z.string().min(1).optional(),
  schedule_name: z.string().min(1).optional(),
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
