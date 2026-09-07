import type { JobResult } from "../models/jobResult";

/*
 * Baked sample data for "mock" data mode (config.ts) — the latest run of
 * each registered job, keyed by job_name (7-data-warehousing.md §11).
 * order_volume_by_stage_7d: a created-date × stage grid over the trailing
 * 7 days, string-valued rows exactly as the API returns them.
 */
function row(created_date: string, stage: string, order_count: number): Record<string, string> {
  return { created_date, stage, order_count: String(order_count) };
}

export const MOCK_JOB_RESULTS: Record<string, JobResult> = {
  order_volume_by_stage_7d: {
    job_name: "order_volume_by_stage_7d",
    job_run_id: "01J8Z2SUCCEEDED000000000002",
    run_date: "2026-09-04",
    computed_at: "2026-09-04T09:00:14.000Z",
    columns: [
      { name: "created_date", type: "varchar" },
      { name: "stage", type: "varchar" },
      { name: "order_count", type: "bigint" },
    ],
    rows: [
      row("2026-08-29", "CLOSED", 1_904),
      row("2026-08-30", "CLOSED", 1_811),
      row("2026-08-30", "WORK", 63),
      row("2026-08-31", "WORK", 210),
      row("2026-08-31", "CLOSED", 940),
      row("2026-09-01", "SCHEDULE", 389),
      row("2026-09-01", "WORK", 412),
      row("2026-09-02", "SCHEDULE", 806),
      row("2026-09-02", "EVALUATION", 88),
      row("2026-09-03", "SCHEDULE", 2_004),
      row("2026-09-03", "INGEST", 1_167),
      row("2026-09-04", "INGEST", 4_918),
      row("2026-09-04", "SCHEDULE", 8_830),
    ],
  },
};
