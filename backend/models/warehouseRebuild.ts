import { z } from "zod";

/*
 * The on-demand warehouse rebuild (`7-data-warehousing.md` §10). `source`
 * is the DynamoDB table, not the warehouse table: `orders` re-derives
 * both `order_snapshots` (`#METADATA`) and `order_events` (`EVENT#`) from
 * one export. No SNS pause — the stream keeps running, and every replayed
 * row is stamped `warehouse_ingested_at = exportTime` so the query dedup
 * (`ROW_NUMBER() … ORDER BY warehouse_ingested_at DESC`) resolves any
 * overlap: a stream row written after the export wins.
 */
export const REBUILD_SOURCES = ["orders", "requests", "locations"] as const;
export type RebuildSource = (typeof REBUILD_SOURCES)[number];

export const WarehouseRebuildTaskSchema = z.object({
  source: z.enum(REBUILD_SOURCES),
  /** The completed export's ARN — its last path segment is the ExportId under `export-staging/<source>/AWSDynamoDB/`. */
  exportArn: z.string().min(1),
  /** ExportTime as ISO — stamped onto every replayed row as `warehouse_ingested_at`. */
  exportTime: z.string().min(1),
});
export type WarehouseRebuildTask = z.infer<typeof WarehouseRebuildTaskSchema>;

export const WarehouseRebuildResultSchema = z.object({
  source: z.enum(REBUILD_SOURCES),
  job_run_id: z.string().min(1),
  /** `data/<table>/` prefixes emptied before the replay. */
  wiped_prefixes: z.array(z.string()),
  /** Rows replayed onto each target warehouse table's Firehose. */
  replayed_by_table: z.record(z.string(), z.number().int().nonnegative()),
  total_replayed: z.number().int().nonnegative(),
});
export type WarehouseRebuildResult = z.infer<typeof WarehouseRebuildResultSchema>;
