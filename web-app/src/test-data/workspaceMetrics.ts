import type { WorkspaceMetrics } from "../models/workspaceMetrics";

/* Baked sample for "mock" data mode: a week to date against the same days of the week before. */
export const MOCK_WORKSPACE_METRICS: WorkspaceMetrics = {
  computed_at: "2026-09-26T06:00:00.000Z",
  week_start: "2026-09-21",
  previous_week_start: "2026-09-14",
  metrics: {
    REQUESTS_ACCEPTED: { current: 411, previous: 8635 },
    SERVICED: { current: 411, previous: 832 },
    MEAN_TIME_TO_RESOLVE_HOURS: { current: 1.02, previous: 115.42 },
    MEDIAN_TIME_TO_RESOLVE_HOURS: { current: 0.95, previous: 5.28 },
    TOTAL_COST: { current: 421380, previous: 458000 },
  },
};
