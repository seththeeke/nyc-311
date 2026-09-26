import type { WorkspaceMetrics } from "../models/workspaceMetrics";

/* Baked sample for "mock" data mode — the Test `wbr` job's 2026-09-21 week against 2026-09-14. */
export const MOCK_WORKSPACE_METRICS: WorkspaceMetrics = {
  source_job: "wbr",
  job_run_id: "01MOCKWBR",
  computed_at: "2026-09-26T06:00:00.000Z",
  week_start: "2026-09-21",
  previous_week_start: "2026-09-14",
  metrics: {
    REQUESTS_ACCEPTED: { current: 411, previous: 8635 },
    SERVICED: { current: 411, previous: 832 },
    MEAN_TIME_TO_RESOLVE_HOURS: { current: 1.02, previous: 115.42 },
    MEDIAN_TIME_TO_RESOLVE_HOURS: { current: 0.95, previous: 5.28 },
    /* The real report has no total_cost column yet; mock mode shows what the tile looks like once it does. */
    TOTAL_COST: { current: 421380, previous: 458000 },
  },
};
