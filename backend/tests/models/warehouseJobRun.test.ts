import { describe, expect, it } from "vitest";
import {
  MAX_JOB_RETRIES,
  WarehouseJobRunListResponseSchema,
  WarehouseJobRunSchema,
} from "../../models/warehouseJobRun";

const valid = {
  job_run_id: "01RUN",
  job_name: "ORDER_VOLUME_BY_STAGE",
  status: "SUCCEEDED",
  trigger: "SCHEDULED",
  started_at: "2026-09-06T09:00:00.000Z",
  completed_at: "2026-09-06T09:00:12.000Z",
  execution_ref: "q-1",
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
      data_scanned_bytes: null,
      engine_execution_time_ms: null,
      query_queue_time_ms: null,
    };
    expect(WarehouseJobRunSchema.parse(running)).toEqual(running);
  });

  it("accepts a RETRY run linking back to the failure it retries", () => {
    const retry = { ...valid, trigger: "RETRY", retry_count: 2, retried_from_job_run_id: "01OLD" };
    expect(WarehouseJobRunSchema.parse(retry)).toEqual(retry);
  });

  it("rejects an unknown status / trigger / negative retry_count", () => {
    expect(WarehouseJobRunSchema.safeParse({ ...valid, status: "PENDING" }).success).toBe(false);
    expect(WarehouseJobRunSchema.safeParse({ ...valid, trigger: "WEBHOOK" }).success).toBe(false);
    expect(WarehouseJobRunSchema.safeParse({ ...valid, retry_count: -1 }).success).toBe(false);
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
