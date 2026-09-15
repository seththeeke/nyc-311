import { z } from "zod";

/*
 * Mirrors backend/controller/web-api/getWarehouseJobSqlController.ts's
 * response for GET /admin/warehouse/jobs/{name}/sql (7-data-warehousing.md
 * §12b's "load a job into the query editor" flow) — the job definition
 * row only stores an S3 key, never the SQL text inline, so loading a job
 * into the editor needs this separate round trip. Every service response
 * is parsed through this schema before it reaches a component (CLAUDE.md
 * §5.1's network-boundary rule).
 */
export const WarehouseJobSqlResponseSchema = z.object({
  sql: z.string().min(1),
});
export type WarehouseJobSqlResponse = z.infer<typeof WarehouseJobSqlResponseSchema>;
