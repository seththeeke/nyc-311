import { z } from "zod";

/*
 * Mirrors backend/models/pollerMetrics.ts exactly — one NYC 311 poller run,
 * as returned by GET /ingestion/metrics (backend/controller/web-api/
 * getPollerMetricsController.ts). Every service response is parsed through
 * this schema before it reaches a component (CLAUDE.md §5.1's "runtime
 * validation at the network boundary" rule).
 */

export const PollerMetricsSchema = z.object({
  ran_at: z.string().min(1),
  success: z.boolean(),
  records_ingested: z.number().int().nonnegative(),
  duplicates_skipped: z.number().int().nonnegative(),
  records_rejected: z.number().int().nonnegative(),
  error_message: z.string().min(1).nullable(),
});

export type PollerMetrics = z.infer<typeof PollerMetricsSchema>;

/*
 * Mirrors backend/models/ingestionCursor.ts's IngestionCursorStatus — the
 * poller's checkpoint plus a computed staleness signal, added after the
 * 2026-08-22 fan-out-Lambda incident (nothing in the DAO/DAO chain was
 * broken, but the pipeline stalled silently for days with no UI signal).
 * `null` on the envelope when no cursor item exists yet.
 */
export const IngestionCursorStatusSchema = z.object({
  last_watermark: z.string().min(1).nullable(),
  resume_offset: z.number().int().nonnegative().nullable(),
  lag_hours: z.number().nonnegative().nullable(),
  is_stale: z.boolean(),
});

export type IngestionCursorStatus = z.infer<typeof IngestionCursorStatusSchema>;

export const PollerMetricsResponseSchema = z.object({
  metrics: z.array(PollerMetricsSchema),
  cursor: IngestionCursorStatusSchema.nullable(),
});

export type PollerMetricsResponse = z.infer<typeof PollerMetricsResponseSchema>;
