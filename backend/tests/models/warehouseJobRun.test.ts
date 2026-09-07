import { describe, expect, it } from "vitest";
import {
  MAX_JOB_RETRIES,
  WarehouseJobRunListResponseSchema,
  WarehouseJobRunSchema,
} from "../../models/warehouseJobRun";

const valid = {
  job_run_id: "01RUN",
  job_name: "order_volume_by_stage_7d",
  status: "SUCCEEDED",
  trigger: "SCHEDULED",
  started_at: "2026-09-06T09:00:00.000Z",
  completed_at: "2026-09-06T09:00:12.000Z",
  execution_ref: "q-1",
  result_location: "s3://nyc311-warehouse-test/job-results/job_name=order_volume_by_stage_7d/run_date=2026-09-06/result.json",
  row_count: 21,
  error_message: null,
  retry_count: 0,
  retried_from_job_run_id: null,
  data_scanned_bytes: 4096,
  engine_execution_time_ms: 1200,
  query_queue_time_ms: 40,
};

describe("WarehouseJobRunSchema", () => {
  it("accepts a completed run", () => {
    expect(WarehouseJobRunSchema.parse(valid)).toEqual(valid);
  });

  it("accepts a RUNNING run with nullable fields null", () => {
    const running = {
      ...valid,
      status: "RUNNING",
      completed_at: null,
      execution_ref: null,
      result_location: null,
      row_count: null,
      data_scanned_bytes: null,
      engine_execution_time_ms: null,
      query_queue_time_ms: null,
    };
    expect(WarehouseJobRunSchema.parse(running)).toEqual(running);
  });

  it("parses a pre-Leg-3.5 row that omits result_location / row_count", () => {
    const legacyRow: Record<string, unknown> = { ...valid };
    delete legacyRow["result_location"];
    delete legacyRow["row_count"];
    const parsed = WarehouseJobRunSchema.parse(legacyRow);
    expect(parsed.result_location ?? null).toBeNull();
    expect(parsed.row_count ?? null).toBeNull();
  });

  it("accepts a RETRY run linking back to the failure it retries", () => {
    const retry = { ...valid, trigger: "RETRY", retry_count: 2, retried_from_job_run_id: "01OLD" };
    expect(WarehouseJobRunSchema.parse(retry)).toEqual(retry);
  });

  it("rejects an unknown status / trigger / negative retry_count / row_count", () => {
    expect(WarehouseJobRunSchema.safeParse({ ...valid, status: "PENDING" }).success).toBe(false);
    expect(WarehouseJobRunSchema.safeParse({ ...valid, trigger: "WEBHOOK" }).success).toBe(false);
    expect(WarehouseJobRunSchema.safeParse({ ...valid, retry_count: -1 }).success).toBe(false);
    expect(WarehouseJobRunSchema.safeParse({ ...valid, row_count: -1 }).success).toBe(false);
  });
});

describe("WarehouseJobRunListResponseSchema", () => {
  it("accepts an empty list", () => {
    expect(WarehouseJobRunListResponseSchema.parse({ jobRuns: [] })).toEqual({ jobRuns: [] });
  });
});

describe("MAX_JOB_RETRIES", () => {
  it("is 3", () => {
    expect(MAX_JOB_RETRIES).toBe(3);
  });
});
