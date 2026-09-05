import { describe, expect, it } from "vitest";
import {
  MAX_JOB_RETRIES,
  WarehouseJobRunListResponseSchema,
  WarehouseJobRunSchema,
} from "../../src/models/warehouseJobRun";

const validJobRun = {
  job_run_id: "01J8Z2SUCCEEDED000000000002",
  job_name: "ORDER_VOLUME_BY_BOROUGH",
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
};

describe("WarehouseJobRunSchema", () => {
  it("accepts a well-formed, completed run", () => {
    expect(WarehouseJobRunSchema.parse(validJobRun)).toEqual(validJobRun);
  });

  it("accepts a still-RUNNING run with every nullable field null", () => {
    const running = {
      ...validJobRun,
      status: "RUNNING",
      completed_at: null,
      data_scanned_bytes: null,
      engine_execution_time_ms: null,
      query_queue_time_ms: null,
    };
    expect(WarehouseJobRunSchema.parse(running)).toEqual(running);
  });

  it("accepts a FAILED run with an error message", () => {
    const failed = { ...validJobRun, status: "FAILED", error_message: "Athena query failed" };
    expect(WarehouseJobRunSchema.parse(failed)).toEqual(failed);
  });

  it("accepts a RETRY run referencing the run it retries", () => {
    const retry = { ...validJobRun, trigger: "RETRY", retry_count: 1, retried_from_job_run_id: "01J8Z0FAILED00000000000004" };
    expect(WarehouseJobRunSchema.parse(retry)).toEqual(retry);
  });

  it("accepts a MANUAL trigger for an on-demand rebuild", () => {
    const rebuild = { ...validJobRun, job_name: "REBUILD_ORDER_EVENTS", trigger: "MANUAL" };
    expect(WarehouseJobRunSchema.parse(rebuild)).toEqual(rebuild);
  });

  it("rejects an unrecognized status", () => {
    expect(WarehouseJobRunSchema.safeParse({ ...validJobRun, status: "PENDING" }).success).toBe(false);
  });

  it("rejects an unrecognized trigger", () => {
    expect(WarehouseJobRunSchema.safeParse({ ...validJobRun, trigger: "WEBHOOK" }).success).toBe(false);
  });

  it("rejects a negative retry_count", () => {
    expect(WarehouseJobRunSchema.safeParse({ ...validJobRun, retry_count: -1 }).success).toBe(false);
  });
});

describe("WarehouseJobRunListResponseSchema", () => {
  it("accepts a well-formed response", () => {
    const response = { jobRuns: [validJobRun] };
    expect(WarehouseJobRunListResponseSchema.parse(response)).toEqual(response);
  });

  it("accepts an empty history", () => {
    const response = { jobRuns: [] };
    expect(WarehouseJobRunListResponseSchema.parse(response)).toEqual(response);
  });
});

describe("MAX_JOB_RETRIES", () => {
  it("is 3, matching this project's standing bounded-retry convention", () => {
    expect(MAX_JOB_RETRIES).toBe(3);
  });
});
