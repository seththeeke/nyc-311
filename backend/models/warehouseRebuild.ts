import { z } from "zod";

/*
 * The on-demand warehouse rebuild (`7-data-warehousing.md` §10). `source`
 * is the DynamoDB table: `orders` re-derives both `order_snapshots`
 * (`#METADATA`) and `order_events` (`EVENT#`). Wipe `data/<table>/`, then
 * replay a PITR export one small chunk at a time — the state machine's
 * `Wait` between chunks is the rate-limit. Replayed rows are stamped
 * `warehouse_ingested_at = exportTime` so the query dedup keeps a later
 * live-stream row winning.
 */
export const REBUILD_SOURCES = ["orders", "requests", "locations"] as const;
export type RebuildSource = (typeof REBUILD_SOURCES)[number];

const sourceField = z.enum(REBUILD_SOURCES);

/** phase 1 — wipe the source's `data/<table>/` prefix(es), open a RUNNING job row, list the export files. */
export const RebuildWipeTaskSchema = z.object({
  phase: z.literal("wipe"),
  source: sourceField,
  exportArn: z.string().min(1),
  startedAt: z.string().min(1),
});
export type RebuildWipeTask = z.infer<typeof RebuildWipeTaskSchema>;

/** One line-range slice of one export data file — the unit the replay `Map` iterates. */
export const RebuildChunkSchema = z.object({
  fileKey: z.string().min(1),
  start: z.number().int().nonnegative(),
  count: z.number().int().positive(),
});
export type RebuildChunk = z.infer<typeof RebuildChunkSchema>;

export const RebuildWipeResultSchema = z.object({
  job_run_id: z.string().min(1),
  chunks: z.array(RebuildChunkSchema).min(1),
});
export type RebuildWipeResult = z.infer<typeof RebuildWipeResultSchema>;

/**
 * phase 2 — replay one chunk (a bounded line range of one export data
 * file) through the live Firehose. The `Map` runs these one at a time
 * with a `Wait` between, so a chunk is small enough that its
 * `firehose:PutRecordBatch` calls never approach the stream limit.
 */
export const RebuildReplayTaskSchema = z.object({
  phase: z.literal("replay"),
  source: sourceField,
  chunk: RebuildChunkSchema,
  exportTime: z.string().min(1),
});
export type RebuildReplayTask = z.infer<typeof RebuildReplayTaskSchema>;

/** One replay's per-warehouse-table row counts, e.g. `{ order_snapshots: 41000, order_events: 200000 }`. */
export const RebuildReplayResultSchema = z.record(z.string(), z.number().int().nonnegative());
export type RebuildReplayResult = z.infer<typeof RebuildReplayResultSchema>;

/** phase 3 — sum the per-file counts, close the job row as SUCCEEDED, drop the export staging. */
export const RebuildFinalizeTaskSchema = z.object({
  phase: z.literal("finalize"),
  source: sourceField,
  exportArn: z.string().min(1),
  jobRunId: z.string().min(1),
  startedAt: z.string().min(1),
  replayResults: z.array(RebuildReplayResultSchema),
});
export type RebuildFinalizeTask = z.infer<typeof RebuildFinalizeTaskSchema>;

/** Catch handler — close the job row as FAILED. `jobRunId` is absent if the wipe phase itself failed. */
export const RebuildFailTaskSchema = z.object({
  phase: z.literal("fail"),
  source: sourceField,
  exportArn: z.string().min(1),
  startedAt: z.string().min(1),
  jobRunId: z.string().min(1).optional(),
  error: z.string().optional(),
});
export type RebuildFailTask = z.infer<typeof RebuildFailTaskSchema>;

export const WarehouseRebuildTaskSchema = z.discriminatedUnion("phase", [
  RebuildWipeTaskSchema,
  RebuildReplayTaskSchema,
  RebuildFinalizeTaskSchema,
  RebuildFailTaskSchema,
]);
export type WarehouseRebuildTask = z.infer<typeof WarehouseRebuildTaskSchema>;

export const WarehouseRebuildResultSchema = z.object({
  source: sourceField,
  job_run_id: z.string().min(1),
  replayed_by_table: z.record(z.string(), z.number().int().nonnegative()),
  total_replayed: z.number().int().nonnegative(),
});
export type WarehouseRebuildResult = z.infer<typeof WarehouseRebuildResultSchema>;
