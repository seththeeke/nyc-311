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

export const PollerMetricsResponseSchema = z.object({
  metrics: z.array(PollerMetricsSchema),
});

export type PollerMetricsResponse = z.infer<typeof PollerMetricsResponseSchema>;
