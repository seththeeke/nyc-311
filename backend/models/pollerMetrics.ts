import { z } from "zod";

// One NYC 311 poller invocation's outcome, per 1-data-ingestion.md §8a.
// Persisted as its own item in the Requests table (base key = a unique
// `METRIC#<ulid>` value, never a real request_id or the CURSOR#NYC_311
// sentinel) and surfaced through the sparse gsi4-poller-metrics GSI so the
// full run history can be queried and listed by time, not just fetched by
// exact key like the cursor sentinel. record_ingested/duplicates_skipped/
// records_rejected mirror PollResult's fields exactly; on a failed run
// (success: false) they're zeroed — the run threw before pollNyc311 could
// return real counts — and error_message carries what went wrong instead.

export const PollerMetricsSchema = z.object({
  ran_at: z.string().min(1),
  success: z.boolean(),
  records_ingested: z.number().int().nonnegative(),
  duplicates_skipped: z.number().int().nonnegative(),
  records_rejected: z.number().int().nonnegative(),
  error_message: z.string().min(1).nullable(),
});

export type PollerMetrics = z.infer<typeof PollerMetricsSchema>;

// Constant string, ALL_CAPS fragment per CLAUDE.md §6 — the sparse GSI4
// partition key every poller-metrics item shares, so a single Query
// returns the full run history.
export const POLLER_METRICS_GSI_PK = "POLLER#METRICS";
