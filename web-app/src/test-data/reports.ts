import type { ReportsResponse } from "../models/report";

/*
 * Baked sample data for "mock" data mode (config.ts) — the reporting
 * surface behind GET /reports (7-data-warehousing.md §12). One report:
 * order_volume_by_stage_8w, an 8-week trend of order count bucketed by
 * creation week, split by current stage.
 */
function week(week: string, values: Record<string, number>): { week: string; values: Record<string, number> } {
  return { week, values };
}

export const MOCK_REPORTS: ReportsResponse = {
  reports: [
    {
      job_name: "order_volume_by_stage_8w",
      title: "Order volume by stage — 8-week trend",
      run_date: "2026-09-04",
      computed_at: "2026-09-04T09:00:14.000Z",
      week_column: "week_start",
      series_column: "stage",
      value_column: "order_count",
      series: ["CLOSED", "EVALUATION", "INGEST", "SCHEDULE", "WORK"],
      weeks: [
        week("2026-07-13", { CLOSED: 8_210, WORK: 41 }),
        week("2026-07-20", { CLOSED: 9_004, WORK: 88 }),
        week("2026-07-27", { CLOSED: 8_770, WORK: 132, EVALUATION: 4 }),
        week("2026-08-03", { CLOSED: 7_990, WORK: 260, SCHEDULE: 12 }),
        week("2026-08-10", { CLOSED: 6_540, WORK: 505, SCHEDULE: 210 }),
        week("2026-08-17", { CLOSED: 4_120, WORK: 1_204, SCHEDULE: 980, EVALUATION: 55 }),
        week("2026-08-24", { CLOSED: 1_870, WORK: 2_990, SCHEDULE: 3_540, EVALUATION: 410, INGEST: 220 }),
        week("2026-08-31", { WORK: 900, SCHEDULE: 6_820, EVALUATION: 1_540, INGEST: 8_110 }),
      ],
    },
  ],
};
