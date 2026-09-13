import { z } from "zod";

/*
 * One resolved warehouse job (`7-data-warehousing.md` §8) — a name and
 * its Athena SQL, ready to run. As of Leg 8 this is resolved per
 * invocation from a `WarehouseJobDefinition` (DynamoDB) + its SQL text
 * (S3) rather than parsed from a synth-time env var — see
 * warehouseJobDefinition.ts. `name` is used verbatim as the S3 partition
 * value and the `WarehouseJobRuns.job_name`.
 */
export const WAREHOUSE_JOB_NAME_REGEX = /^[a-z0-9_]+$/;

export const WarehouseJobSchema = z.object({
  name: z.string().min(1).regex(WAREHOUSE_JOB_NAME_REGEX, "job name must be lower_snake_case (S3 partition-safe)"),
  sql: z.string().min(1),
});
export type WarehouseJob = z.infer<typeof WarehouseJobSchema>;
