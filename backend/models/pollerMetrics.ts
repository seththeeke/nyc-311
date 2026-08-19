import { z } from "zod";

/*
 * One poller invocation's outcome (1-data-ingestion.md §8a). Stored as its
 * own `METRIC#<ulid>` item, surfaced via the sparse gsi4-poller-metrics GSI
 * so the full run history can be queried by time. On a failed run the
 * count fields are zeroed and error_message carries what went wrong.
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
 * Constant string, ALL_CAPS fragment per CLAUDE.md §6 — the sparse GSI4
 * partition key every poller-metrics item shares, so a single Query
 * returns the full run history.
 */
export const POLLER_METRICS_GSI_PK = "POLLER#METRICS";
