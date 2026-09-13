import { z } from "zod";

/*
 * Mirrors backend/models/warehouseJobDefinition.ts
 * (7-data-warehousing.md §8/§12b, Leg 8) — a self-service job's
 * metadata, as returned by POST/GET /admin/warehouse/jobs. Every service
 * response is parsed through this schema before it reaches a component
 * (CLAUDE.md §5.1's network-boundary rule).
 */

export const WAREHOUSE_JOB_NAME_REGEX = /^[a-z0-9_]+$/;

export const WarehouseJobDefinitionSchema = z.object({
  job_run_id: z.string().min(1),
  record_type: z.literal("DEFINITION"),
  job_name: z.string().min(1).regex(WAREHOUSE_JOB_NAME_REGEX, "Job name must be lowercase letters, digits, and underscores only"),
  sql_s3_key: z.string().min(1),
  cadence_cron: z.string().min(1),
  schedule_name: z.string().min(1),
  created_at: z.string().min(1),
  created_by: z.string().min(1),
});
export type WarehouseJobDefinition = z.infer<typeof WarehouseJobDefinitionSchema>;

export const WarehouseJobDefinitionListResponseSchema = z.object({
  jobs: z.array(WarehouseJobDefinitionSchema),
});
export type WarehouseJobDefinitionListResponse = z.infer<typeof WarehouseJobDefinitionListResponseSchema>;
