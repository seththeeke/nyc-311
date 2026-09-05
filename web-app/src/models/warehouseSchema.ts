import { z } from "zod";

/*
 * Mirrors the future backend/models/warehouseSchema.ts (7-data-warehousing.md
 * §12) — GET /data/schema's response, a live read of the Glue Data Catalog
 * rather than a checked-in copy, so a schema change shows up here with zero
 * frontend code change. Every service response is parsed through this schema
 * before it reaches a component (CLAUDE.md §5.1's network-boundary rule).
 */

export const WarehouseColumnSchema = z.object({
  name: z.string().min(1),
  type: z.string().min(1),
  comment: z.string().min(1).nullable(),
});
export type WarehouseColumn = z.infer<typeof WarehouseColumnSchema>;

export const WarehouseTableSchema = z.object({
  table_name: z.string().min(1),
  columns: z.array(WarehouseColumnSchema),
});
export type WarehouseTable = z.infer<typeof WarehouseTableSchema>;

export const WarehouseSchemaResponseSchema = z.object({
  tables: z.array(WarehouseTableSchema),
});
export type WarehouseSchemaResponse = z.infer<typeof WarehouseSchemaResponseSchema>;
