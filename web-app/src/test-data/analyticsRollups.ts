import type { AnalyticsRollupListResponse } from "../models/analyticsRollup";

/*
 * Baked sample data for "mock" data mode (config.ts) — the sample job's
 * output (7-data-warehousing.md §1/§11): a count of Orders per
 * current_stage from the latest run, plus one prior run's rows so mock
 * mode shows a short daily time series. rollup_key is `<run_date>#<dimension>`.
 */
export const MOCK_ANALYTICS_ROLLUPS: AnalyticsRollupListResponse = {
  rollups: [
    {
      metric_view: "ORDER_VOLUME_BY_STAGE",
      rollup_key: "2026-09-04#EVALUATION",
      run_date: "2026-09-04",
      dimension: "EVALUATION",
      value: 128,
      computed_at: "2026-09-04T09:00:14.000Z",
      job_run_id: "01J8Z2SUCCEEDED000000000002",
    },
    {
      metric_view: "ORDER_VOLUME_BY_STAGE",
      rollup_key: "2026-09-04#SCHEDULE",
      run_date: "2026-09-04",
      dimension: "SCHEDULE",
      value: 412,
      computed_at: "2026-09-04T09:00:14.000Z",
      job_run_id: "01J8Z2SUCCEEDED000000000002",
    },
    {
      metric_view: "ORDER_VOLUME_BY_STAGE",
      rollup_key: "2026-09-04#WORK",
      run_date: "2026-09-04",
      dimension: "WORK",
      value: 87,
      computed_at: "2026-09-04T09:00:14.000Z",
      job_run_id: "01J8Z2SUCCEEDED000000000002",
    },
    {
      metric_view: "ORDER_VOLUME_BY_STAGE",
      rollup_key: "2026-09-04#CLOSED",
      run_date: "2026-09-04",
      dimension: "CLOSED",
      value: 1_904,
      computed_at: "2026-09-04T09:00:14.000Z",
      job_run_id: "01J8Z2SUCCEEDED000000000002",
    },
    {
      metric_view: "ORDER_VOLUME_BY_STAGE",
      rollup_key: "2026-09-03#SCHEDULE",
      run_date: "2026-09-03",
      dimension: "SCHEDULE",
      value: 389,
      computed_at: "2026-09-03T09:15:11.000Z",
      job_run_id: "01J8Z1RETRIED0000000000003",
    },
    {
      metric_view: "ORDER_VOLUME_BY_STAGE",
      rollup_key: "2026-09-03#CLOSED",
      run_date: "2026-09-03",
      dimension: "CLOSED",
      value: 1_811,
      computed_at: "2026-09-03T09:15:11.000Z",
      job_run_id: "01J8Z1RETRIED0000000000003",
    },
  ],
};
