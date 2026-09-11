import { S3Client, GetObjectCommand, type GetObjectCommandOutput } from "@aws-sdk/client-s3";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { mockClient } from "aws-sdk-client-mock";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getJobResult } from "../../../service/analytics/jobResultService";
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

function fakeDao(latest: WarehouseJobRun | null): WarehouseJobRunsDao {
  return { getLatestSucceededRunForJob: vi.fn().mockResolvedValue(latest) } as unknown as WarehouseJobRunsDao;
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

describe("getJobResult", () => {
  it("resolves the latest SUCCEEDED run's result_location, GetObjects it, and returns the parsed envelope", async () => {
    const dao = fakeDao(succeededRun());
    s3Mock.on(GetObjectCommand).resolves(s3Response(JSON.stringify(ENVELOPE)));

    const result = await getJobResult("order_volume_by_stage_7d", { jobRunsDao: dao, s3Client });

    expect(result).toEqual(ENVELOPE);
    const get = s3Mock.commandCalls(GetObjectCommand)[0].args[0].input;
    expect(get.Bucket).toBe("nyc311-warehouse-test");
    expect(get.Key).toBe("job-results/job_name=order_volume_by_stage_7d/run_date=2026-09-07/result.json");
  });

  it("returns null when the job has no succeeded run", async () => {
    const dao = fakeDao(null);
    expect(await getJobResult("order_volume_by_stage_7d", { jobRunsDao: dao, s3Client })).toBeNull();
    expect(s3Mock.commandCalls(GetObjectCommand)).toHaveLength(0);
  });

  it("returns null when the latest succeeded run has no result_location", async () => {
    const dao = fakeDao(succeededRun({ result_location: null }));
    expect(await getJobResult("order_volume_by_stage_7d", { jobRunsDao: dao, s3Client })).toBeNull();
  });

  it("throws when the stored object fails envelope validation", async () => {
    const dao = fakeDao(succeededRun());
    s3Mock.on(GetObjectCommand).resolves(s3Response(JSON.stringify({ not: "an envelope" })));

    await expect(getJobResult("order_volume_by_stage_7d", { jobRunsDao: dao, s3Client })).rejects.toThrow();
  });

  it("throws on an empty result object", async () => {
    const dao = fakeDao(succeededRun());
    s3Mock.on(GetObjectCommand).resolves({});

    await expect(getJobResult("order_volume_by_stage_7d", { jobRunsDao: dao, s3Client })).rejects.toThrow("Empty result");
  });

  it("throws on a result_location that isn't an s3:// URI", async () => {
    const dao = fakeDao(succeededRun({ result_location: "https://example.com/x" }));
    await expect(getJobResult("order_volume_by_stage_7d", { jobRunsDao: dao, s3Client })).rejects.toThrow("s3://");
  });

  it("constructs a default DAO from WAREHOUSE_JOB_RUNS_TABLE_NAME when none is injected", async () => {
    const prev = process.env["WAREHOUSE_JOB_RUNS_TABLE_NAME"];
    process.env["WAREHOUSE_JOB_RUNS_TABLE_NAME"] = "WarehouseJobRuns-Test";
    ddbMock.on(QueryCommand).resolves({ Items: [] });
    try {
      expect(await getJobResult("order_volume_by_stage_7d", { s3Client })).toBeNull();
      expect(ddbMock.commandCalls(QueryCommand)).toHaveLength(1);
    } finally {
      if (prev === undefined) delete process.env["WAREHOUSE_JOB_RUNS_TABLE_NAME"];
      else process.env["WAREHOUSE_JOB_RUNS_TABLE_NAME"] = prev;
    }
  });

  it("constructs a default S3 client when none is injected", async () => {
    /* No result_location means the default S3Client is built but never used to send — cheap way to exercise the `?? new S3Client({})` fallback. */
    const dao = fakeDao(null);
    expect(await getJobResult("order_volume_by_stage_7d", { jobRunsDao: dao })).toBeNull();
  });

  it("throws when WAREHOUSE_JOB_RUNS_TABLE_NAME is unset and no DAO is injected", async () => {
    const prev = process.env["WAREHOUSE_JOB_RUNS_TABLE_NAME"];
    delete process.env["WAREHOUSE_JOB_RUNS_TABLE_NAME"];
    try {
      await expect(getJobResult("order_volume_by_stage_7d", { s3Client })).rejects.toThrow(
        "WAREHOUSE_JOB_RUNS_TABLE_NAME"
      );
    } finally {
      if (prev !== undefined) process.env["WAREHOUSE_JOB_RUNS_TABLE_NAME"] = prev;
    }
  });
});
