import { z } from "zod";
import { WAREHOUSE_JOB_NAME_REGEX } from "./warehouseJob";

/*
 * POST/DELETE /admin/warehouse/jobs[/{name}]'s request shapes
 * (7-data-warehousing.md §12b, Leg 8).
 */

/*
 * A name, an EventBridge Scheduler cron(...) expression, and the
 * query's SQL text. `cadence_cron` isn't format-validated here beyond
 * non-empty — EventBridge Scheduler's own CreateSchedule call is the
 * authoritative validator (§12b), surfaced back as a clear error rather
 * than duplicated client-side.
 */
export const CreateWarehouseJobRequestSchema = z.object({
  name: z.string().min(1).regex(WAREHOUSE_JOB_NAME_REGEX, "job name must be lower_snake_case (S3 partition-safe)"),
  cadence_cron: z.string().min(1),
  sql: z.string().min(1),
});
export type CreateWarehouseJobRequest = z.infer<typeof CreateWarehouseJobRequestSchema>;

export const DeleteWarehouseJobParamsSchema = z.object({
  name: z.string().min(1),
});
export type DeleteWarehouseJobParams = z.infer<typeof DeleteWarehouseJobParamsSchema>;
