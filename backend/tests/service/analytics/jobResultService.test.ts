import { S3Client, GetObjectCommand, type GetObjectCommandOutput } from "@aws-sdk/client-s3";
import { DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb";
import { mockClient } from "aws-sdk-client-mock";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getJobRunResults } from "../../../service/analytics/jobResultService";
import type { WarehouseJobRunsDao } from "../../../dao/analytics/warehouseJobRunsDao";
import type { WarehouseJobRun } from "../../../models/warehouseJobRun";

const s3Mock = mockClient(S3Client);
const s3Client = new S3Client({});
const ddbMock = mockClient(DynamoDBDocumentClient);

const ENVELOPE = {
  job_name: "order_volume_by_stage_7d",
  job_run_id: "01RUN",
  run_date: "2026-09-07",
  computed_at: "2026-09-07T14:16:36.410Z",
  columns: [
    { name: "created_date", type: "varchar" },
    { name: "stage", type: "varchar" },
    { name: "order_count", type: "bigint" },
  ],
  rows: [{ created_date: "2026-09-01", stage: "SCHEDULE", order_count: "8830" }],
};

function succeededRun(overrides: Partial<WarehouseJobRun> = {}): WarehouseJobRun {
  return {
    job_run_id: "01RUN",
    job_name: "order_volume_by_stage_7d",
    status: "SUCCEEDED",
    trigger: "SCHEDULED",
    started_at: "2026-09-07T09:00:00.000Z",
    completed_at: "2026-09-07T09:00:10.000Z",
    execution_ref: "q",
    result_location:
      "s3://nyc311-warehouse-test/job-results/job_name=order_volume_by_stage_7d/run_date=2026-09-07/result.json",
    row_count: 1,
    error_message: null,
    retry_count: 0,
    retried_from_job_run_id: null,
    data_scanned_bytes: 1,
    engine_execution_time_ms: 1,
    query_queue_time_ms: 1,
    ...overrides,
  };
}

/** Maps job_run_id → the run `getJobRun` should resolve to (or `null`/undefined for "no such run"). */
function fakeJobRunDao(runsById: Record<string, WarehouseJobRun | null | undefined>): WarehouseJobRunsDao {
  return {
    getJobRun: vi.fn(async (jobRunId: string) => runsById[jobRunId] ?? null),
  } as unknown as WarehouseJobRunsDao;
}

/* The service only calls `Body.transformToString()`; a minimal stand-in is enough. */
function s3Response(text: string): GetObjectCommandOutput {
  return { Body: { transformToString: async () => text } } as unknown as GetObjectCommandOutput;
}

beforeEach(() => {
  s3Mock.reset();
  ddbMock.reset();
  vi.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("getJobRunResults", () => {
  it("resolves each id's own run and returns one result item per id", async () => {
    const dao = fakeJobRunDao({
      "01A": succeededRun({ job_run_id: "01A" }),
      "01B": succeededRun({
        job_run_id: "01B",
        result_location: "s3://nyc311-warehouse-test/job-results/job_name=other_job/run_date=2026-09-08/result.json",
      }),
    });
    s3Mock.on(GetObjectCommand).resolves(s3Response(JSON.stringify(ENVELOPE)));

    const results = await getJobRunResults(["01A", "01B"], { jobRunsDao: dao, s3Client });

    expect(results).toEqual([
      { job_run_id: "01A", result: ENVELOPE, error: null },
      { job_run_id: "01B", result: ENVELOPE, error: null },
    ]);
    expect(s3Mock.commandCalls(GetObjectCommand)).toHaveLength(2);
  });

  it("sets a per-item error, without affecting other items, when a run doesn't exist", async () => {
    const dao = fakeJobRunDao({ "01A": succeededRun({ job_run_id: "01A" }), "01GHOST": null });
    s3Mock.on(GetObjectCommand).resolves(s3Response(JSON.stringify(ENVELOPE)));

    const results = await getJobRunResults(["01A", "01GHOST"], { jobRunsDao: dao, s3Client });

    expect(results).toEqual([
      { job_run_id: "01A", result: ENVELOPE, error: null },
      { job_run_id: "01GHOST", result: null, error: "No result for this job run" },
    ]);
  });

  it("sets a per-item error, without affecting other items, when a run has no result_location", async () => {
    const dao = fakeJobRunDao({
      "01A": succeededRun({ job_run_id: "01A" }),
      "01RUNNING": succeededRun({ job_run_id: "01RUNNING", status: "RUNNING", result_location: null }),
    });
    s3Mock.on(GetObjectCommand).resolves(s3Response(JSON.stringify(ENVELOPE)));

    const results = await getJobRunResults(["01A", "01RUNNING"], { jobRunsDao: dao, s3Client });

    expect(results).toEqual([
      { job_run_id: "01A", result: ENVELOPE, error: null },
      { job_run_id: "01RUNNING", result: null, error: "No result for this job run" },
    ]);
  });

  it("sets a per-item error, without affecting other items, when an S3 fetch fails", async () => {
    const dao = fakeJobRunDao({
      "01A": succeededRun({ job_run_id: "01A" }),
      "01BROKEN": succeededRun({
        job_run_id: "01BROKEN",
        result_location: "s3://nyc311-warehouse-test/job-results/job_name=broken_job/run_date=2026-09-08/result.json",
      }),
    });
    s3Mock.on(GetObjectCommand).callsFake((input: { Key?: string }) => {
      if (input.Key?.includes("broken_job")) throw new Error("S3 unavailable");
      return s3Response(JSON.stringify(ENVELOPE));
    });

    const results = await getJobRunResults(["01A", "01BROKEN"], { jobRunsDao: dao, s3Client });

    expect(results).toEqual([
      { job_run_id: "01A", result: ENVELOPE, error: null },
      { job_run_id: "01BROKEN", result: null, error: "S3 unavailable" },
    ]);
  });

  it("sets a per-item error for an empty result object or a result_location that isn't an s3:// URI", async () => {
    s3Mock.on(GetObjectCommand).resolves(s3Response(""));
    const dao = fakeJobRunDao({ EMPTY: succeededRun({ job_run_id: "EMPTY" }), BADURI: succeededRun({ job_run_id: "BADURI", result_location: "https://nope" }) });

    const results = await getJobRunResults(["EMPTY", "BADURI"], { jobRunsDao: dao, s3Client });

    expect(results.map((item) => item.result)).toEqual([null, null]);
    expect(results[0].error).toMatch(/Empty result object/);
    expect(results[1].error).toMatch(/Not an s3:\/\/ URI/);
  });

  it("returns [] for an empty id list", async () => {
    const dao = fakeJobRunDao({});
    expect(await getJobRunResults([], { jobRunsDao: dao, s3Client })).toEqual([]);
  });

  it("sets a per-item generic-message error when a non-Error value is thrown", async () => {
    const dao = {
      getJobRun: vi.fn().mockRejectedValue("string failure"),
    } as unknown as WarehouseJobRunsDao;

    const results = await getJobRunResults(["01A"], { jobRunsDao: dao, s3Client });

    expect(results).toEqual([{ job_run_id: "01A", result: null, error: "Failed to load result" }]);
  });

  it("constructs a default DAO from WAREHOUSE_JOB_RUNS_TABLE_NAME when none is injected", async () => {
    const prev = process.env["WAREHOUSE_JOB_RUNS_TABLE_NAME"];
    process.env["WAREHOUSE_JOB_RUNS_TABLE_NAME"] = "WarehouseJobRuns-Test";
    ddbMock.on(GetCommand).resolves({});
    try {
      const results = await getJobRunResults(["01A"], { s3Client });
      expect(results).toEqual([{ job_run_id: "01A", result: null, error: "No result for this job run" }]);
      expect(ddbMock.commandCalls(GetCommand)).toHaveLength(1);
    } finally {
      if (prev === undefined) delete process.env["WAREHOUSE_JOB_RUNS_TABLE_NAME"];
      else process.env["WAREHOUSE_JOB_RUNS_TABLE_NAME"] = prev;
    }
  });

  it("constructs a default S3 client when none is injected", async () => {
    /* No result_location means the default S3Client is built but never used to send — cheap way to exercise the `?? new S3Client({})` fallback. */
    const dao = fakeJobRunDao({ "01A": null });
    expect(await getJobRunResults(["01A"], { jobRunsDao: dao })).toEqual([
      { job_run_id: "01A", result: null, error: "No result for this job run" },
    ]);
  });

  it("throws when WAREHOUSE_JOB_RUNS_TABLE_NAME is unset and no DAO is injected", async () => {
    const prev = process.env["WAREHOUSE_JOB_RUNS_TABLE_NAME"];
    delete process.env["WAREHOUSE_JOB_RUNS_TABLE_NAME"];
    try {
      await expect(getJobRunResults(["01A"], { s3Client })).rejects.toThrow("WAREHOUSE_JOB_RUNS_TABLE_NAME");
    } finally {
      if (prev !== undefined) process.env["WAREHOUSE_JOB_RUNS_TABLE_NAME"] = prev;
    }
  });
});
