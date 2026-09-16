import type { JobResult } from "../models/jobResult";

/*
 * Baked sample data for "mock" data mode (config.ts), keyed by
 * job_run_id (unlike test-data/jobResult.ts's per-job-name latest-result
 * fixture) — backs the admin Reports tab's per-run lookup
 * (7-data-warehousing.md §12b). Covers the two SUCCEEDED runs in
 * test-data/warehouseJobRuns.ts; any other job_run_id (RUNNING, FAILED,
 * or unknown) legitimately has no result, same as the real endpoint.
 */
function row(created_date: string, stage: string, order_count: number): Record<string, string> {
  return { created_date, stage, order_count: String(order_count) };
}

const COLUMNS = [
  { name: "created_date", type: "varchar" },
  { name: "stage", type: "varchar" },
  { name: "order_count", type: "bigint" },
];

export const MOCK_JOB_RUN_RESULTS: Record<string, JobResult> = {
  "01J8Z2SUCCEEDED000000000002": {
    job_name: "order_volume_by_stage_7d",
    job_run_id: "01J8Z2SUCCEEDED000000000002",
    run_date: "2026-09-04",
    computed_at: "2026-09-04T09:00:14.000Z",
    columns: COLUMNS,
    rows: [
      row("2026-09-03", "SCHEDULE", 2_004),
      row("2026-09-03", "INGEST", 1_167),
      row("2026-09-04", "INGEST", 4_918),
      row("2026-09-04", "SCHEDULE", 8_830),
    ],
  },
  "01J8Z1RETRIED0000000000003": {
    job_name: "order_volume_by_stage_7d",
    job_run_id: "01J8Z1RETRIED0000000000003",
    run_date: "2026-09-03",
    computed_at: "2026-09-03T09:15:11.000Z",
    columns: COLUMNS,
    rows: [row("2026-09-02", "SCHEDULE", 806), row("2026-09-02", "EVALUATION", 88), row("2026-09-03", "SCHEDULE", 2_004)],
  },
};
