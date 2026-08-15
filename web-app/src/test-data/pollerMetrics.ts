import type { PollerMetrics } from "../models/pollerMetrics";

// Baked sample data for "mock" data mode (config.ts) — a small, lightweight
// fixture set, not a snapshot of real production data. Mixes success and
// failure runs so the ingestion-metrics tile has something realistic to
// render without a live backend.
export const MOCK_POLLER_METRICS: PollerMetrics[] = [
  {
    ran_at: "2026-08-15T18:00:00.000Z",
    success: true,
    records_ingested: 42,
    duplicates_skipped: 5,
    records_rejected: 0,
    error_message: null,
  },
  {
    ran_at: "2026-08-15T12:00:00.000Z",
    success: true,
    records_ingested: 0,
    duplicates_skipped: 118,
    records_rejected: 0,
    error_message: null,
  },
  {
    ran_at: "2026-08-15T06:00:00.000Z",
    success: false,
    records_ingested: 0,
    duplicates_skipped: 0,
    records_rejected: 0,
    error_message: "SODA API request timed out",
  },
  {
    ran_at: "2026-08-15T00:00:00.000Z",
    success: true,
    records_ingested: 2000,
    duplicates_skipped: 0,
    records_rejected: 3,
    error_message: null,
  },
];
