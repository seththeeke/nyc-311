/*
 * Summary of one NYC 311 poller invocation. Not persisted or read from an
 * external boundary (it's the service's own return value, destined for the
 * controller's response and the "PollCompleted" structured log line
 * 1-data-ingestion.md §8 defines the custom metrics against), so unlike
 * Request/IngestionCursor it has no paired zod schema.
 */

export interface PollResult {
  recordsIngested: number;
  duplicatesSkipped: number;
  recordsRejected: number;
}
