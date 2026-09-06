import type { WarehouseJobRunListResponse } from "../models/warehouseJobRun";

/*
 * Baked sample data for "mock" data mode (config.ts) — a mix of statuses
 * and triggers so mock mode exercises every visual state
 * (7-data-warehousing.md §12): a healthy scheduled run with query-perf
 * stats, a failed run that a RETRY-triggered run then resolved, one still
 * RUNNING, and an older failed run that exhausted MAX_JOB_RETRIES and
 * stopped auto-retrying. All the sample job (ORDER_VOLUME_BY_STAGE); the
 * MANUAL trigger and on-demand rebuilds (§10) arrive with Leg 4.
 */
export const MOCK_WAREHOUSE_JOB_RUNS: WarehouseJobRunListResponse = {
  jobRuns: [
    {
      job_run_id: "01J8Z3RUNNING0000000000001",
      job_name: "ORDER_VOLUME_BY_STAGE",
      status: "RUNNING",
      trigger: "SCHEDULED",
      started_at: "2026-09-05T09:00:02.000Z",
      completed_at: null,
      execution_ref: "9f2c7a41-4b3e-4d2a-8c1f-3a7e6b2d9f10",
      error_message: null,
      retry_count: 0,
      retried_from_job_run_id: null,
      data_scanned_bytes: null,
      engine_execution_time_ms: null,
      query_queue_time_ms: null,
    },
    {
      job_run_id: "01J8Z2SUCCEEDED000000000002",
      job_name: "ORDER_VOLUME_BY_STAGE",
      status: "SUCCEEDED",
      trigger: "SCHEDULED",
      started_at: "2026-09-04T09:00:01.000Z",
      completed_at: "2026-09-04T09:00:14.000Z",
      execution_ref: "6e1b9c22-7a4f-4e8d-9b2a-1c5d8e3f7a90",
      error_message: null,
      retry_count: 0,
      retried_from_job_run_id: null,
      data_scanned_bytes: 4_213_888,
      engine_execution_time_ms: 1_842,
      query_queue_time_ms: 96,
    },
    {
      job_run_id: "01J8Z1RETRIED0000000000003",
      job_name: "ORDER_VOLUME_BY_STAGE",
      status: "SUCCEEDED",
      trigger: "RETRY",
      started_at: "2026-09-03T09:15:00.000Z",
      completed_at: "2026-09-03T09:15:11.000Z",
      execution_ref: "2b6a4c88-3d1e-4a7f-8e2b-9f4c1a6d5b30",
      error_message: null,
      retry_count: 1,
      retried_from_job_run_id: "01J8Z0FAILED00000000000004",
      data_scanned_bytes: 3_987_120,
      engine_execution_time_ms: 1_705,
      query_queue_time_ms: 110,
    },
    {
      job_run_id: "01J8Z0FAILED00000000000004",
      job_name: "ORDER_VOLUME_BY_STAGE",
      status: "FAILED",
      trigger: "SCHEDULED",
      started_at: "2026-09-03T09:00:03.000Z",
      completed_at: "2026-09-03T09:00:19.000Z",
      execution_ref: "8a3f5e17-6c2d-4b9a-af31-7d0e2c9b4f61",
      error_message: "Athena query FAILED: SYNTAX_ERROR: line 4:8: Column 'current_stage' cannot be resolved",
      retry_count: 0,
      retried_from_job_run_id: null,
      data_scanned_bytes: null,
      engine_execution_time_ms: null,
      query_queue_time_ms: null,
    },
    {
      job_run_id: "01J8Y8EXHAUSTED0000000000005",
      job_name: "ORDER_VOLUME_BY_STAGE",
      status: "FAILED",
      trigger: "RETRY",
      started_at: "2026-09-01T09:45:00.000Z",
      completed_at: "2026-09-01T09:45:16.000Z",
      execution_ref: "7f1d9033-2a4e-4c8b-9d1a-5e2c6f0b3a71",
      error_message: "Athena query FAILED: HIVE_CANNOT_OPEN_SPLIT: partition not found",
      retry_count: 3,
      retried_from_job_run_id: "01J8Y7RETRY20000000000006",
      data_scanned_bytes: null,
      engine_execution_time_ms: null,
      query_queue_time_ms: null,
    },
  ],
};
