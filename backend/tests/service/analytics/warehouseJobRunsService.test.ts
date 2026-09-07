import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { mockClient } from "aws-sdk-client-mock";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { listWarehouseJobRuns } from "../../../service/analytics/warehouseJobRunsService";
import type { WarehouseJobRunsDao } from "../../../dao/analytics/warehouseJobRunsDao";
import type { WarehouseJobRun } from "../../../models/warehouseJobRun";

const ddbMock = mockClient(DynamoDBDocumentClient);

beforeEach(() => {
  ddbMock.reset();
  vi.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

function run(id: string): WarehouseJobRun {
  return {
    job_run_id: id,
    job_name: "order_volume_by_stage_7d",
    status: "SUCCEEDED",
    trigger: "SCHEDULED",
    started_at: "2026-09-06T09:00:00.000Z",
    completed_at: "2026-09-06T09:00:10.000Z",
    execution_ref: "q",
    result_location: "s3://b/job-results/job_name=order_volume_by_stage_7d/run_date=2026-09-06/result.json",
    row_count: 21,
    error_message: null,
    retry_count: 0,
    retried_from_job_run_id: null,
    data_scanned_bytes: 1,
    engine_execution_time_ms: 1,
    query_queue_time_ms: 1,
  };
}

describe("listWarehouseJobRuns", () => {
  it("returns the DAO's recent runs wrapped in { jobRuns }", async () => {
    const dao = { listRecentJobRuns: vi.fn().mockResolvedValue([run("a"), run("b")]) } as unknown as WarehouseJobRunsDao;

    const result = await listWarehouseJobRuns({ jobRunsDao: dao, limit: 5 });

    expect(dao.listRecentJobRuns).toHaveBeenCalledWith(5);
    expect(result.jobRuns.map((r) => r.job_run_id)).toEqual(["a", "b"]);
  });

  it("defaults the limit to 100", async () => {
    const dao = { listRecentJobRuns: vi.fn().mockResolvedValue([]) } as unknown as WarehouseJobRunsDao;

    await listWarehouseJobRuns({ jobRunsDao: dao });

    expect(dao.listRecentJobRuns).toHaveBeenCalledWith(100);
  });

  it("constructs a default DAO from WAREHOUSE_JOB_RUNS_TABLE_NAME when none is injected", async () => {
    const prev = process.env["WAREHOUSE_JOB_RUNS_TABLE_NAME"];
    process.env["WAREHOUSE_JOB_RUNS_TABLE_NAME"] = "WarehouseJobRuns-Test";
    ddbMock.on(QueryCommand).resolves({ Items: [] });
    try {
      const result = await listWarehouseJobRuns();
      expect(result.jobRuns).toEqual([]);
      expect(ddbMock.commandCalls(QueryCommand)).toHaveLength(1);
    } finally {
      if (prev === undefined) delete process.env["WAREHOUSE_JOB_RUNS_TABLE_NAME"];
      else process.env["WAREHOUSE_JOB_RUNS_TABLE_NAME"] = prev;
    }
  });

  it("throws when WAREHOUSE_JOB_RUNS_TABLE_NAME is unset and no DAO is injected", async () => {
    const prev = process.env["WAREHOUSE_JOB_RUNS_TABLE_NAME"];
    delete process.env["WAREHOUSE_JOB_RUNS_TABLE_NAME"];
    try {
      await expect(listWarehouseJobRuns()).rejects.toThrow("WAREHOUSE_JOB_RUNS_TABLE_NAME");
    } finally {
      if (prev !== undefined) process.env["WAREHOUSE_JOB_RUNS_TABLE_NAME"] = prev;
    }
  });
});
