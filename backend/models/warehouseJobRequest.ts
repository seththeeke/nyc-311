import { z } from "zod";
import { WAREHOUSE_JOB_NAME_REGEX, WAREHOUSE_JOB_TYPES } from "./warehouseJob";

/*
 * POST/DELETE /admin/warehouse/jobs[/{name}]'s request shapes
 * (7-data-warehousing.md §12b, Leg 8; job_type/saved-query support added
 * for the admin warehouse query-tabs enhancement).
 */

/*
 * A name, a job type, and the query's SQL text. `cadence_cron` is
 * required only for a `SCHEDULED` job (a `SAVED_QUERY` never gets an
 * EventBridge Scheduler schedule) — the `.refine()` below enforces that
 * pairing. `cadence_cron` isn't format-validated beyond non-empty when
 * present — EventBridge Scheduler's own CreateSchedule call is the
 * authoritative validator (§12b), surfaced back as a clear error rather
 * than duplicated client-side.
 */
export const CreateWarehouseJobRequestSchema = z
  .object({
    name: z.string().min(1).regex(WAREHOUSE_JOB_NAME_REGEX, "job name must be lower_snake_case (S3 partition-safe)"),
    job_type: z.enum(WAREHOUSE_JOB_TYPES),
    cadence_cron: z.string().min(1).optional(),
    sql: z.string().min(1),
  })
  .refine((body) => body.job_type !== "SCHEDULED" || !!body.cadence_cron, {
    message: "cadence_cron is required for a SCHEDULED job",
    path: ["cadence_cron"],
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
 * (warehouseJobDefinitionService.ts), never itself editable. `job_type` is
 * likewise not here — it's fixed at creation and read back off the
 * existing row, not re-submitted. `cadence_cron` is optional: a
 * `SAVED_QUERY` update never carries one, and the service ignores it even
 * if sent for one.
 */
export const UpdateWarehouseJobRequestSchema = z.object({
  cadence_cron: z.string().min(1).optional(),
  sql: z.string().min(1),
});
export type UpdateWarehouseJobRequest = z.infer<typeof UpdateWarehouseJobRequestSchema>;
