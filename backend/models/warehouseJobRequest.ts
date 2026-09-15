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

/** `{name}` path param shared by every `/admin/warehouse/jobs/{name}` route (PUT, DELETE, GET .../sql). */
export const WarehouseJobNameParamsSchema = z.object({
  name: z.string().min(1),
});
export type WarehouseJobNameParams = z.infer<typeof WarehouseJobNameParamsSchema>;

/*
 * PUT /admin/warehouse/jobs/{name}'s request body — no `name` field since
 * it's the path param; a job's name is its stable identity for life
 * (warehouseJobDefinitionService.ts), never itself editable.
 */
export const UpdateWarehouseJobRequestSchema = z.object({
  cadence_cron: z.string().min(1),
  sql: z.string().min(1),
});
export type UpdateWarehouseJobRequest = z.infer<typeof UpdateWarehouseJobRequestSchema>;
