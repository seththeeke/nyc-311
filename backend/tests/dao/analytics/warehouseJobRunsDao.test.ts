import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { mockClient } from "aws-sdk-client-mock";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WarehouseJobRunsDao } from "../../../dao/analytics/warehouseJobRunsDao";
import type { WarehouseJobRun } from "../../../models/warehouseJobRun";

const ddbMock = mockClient(DynamoDBDocumentClient);
const dao = new WarehouseJobRunsDao(DynamoDBDocumentClient.from(new DynamoDBClient({})), "WarehouseJobRuns-Test");

function run(overrides: Partial<WarehouseJobRun> = {}): WarehouseJobRun {
  return {
    job_run_id: "01RUN",
    job_name: "order_volume_by_stage_7d",
    status: "RUNNING",
    trigger: "SCHEDULED",
    started_at: "2026-09-06T09:00:00.000Z",
    completed_at: null,
    execution_ref: null,
    result_location: null,
    row_count: null,
    error_message: null,
    retry_count: 0,
    retried_from_job_run_id: null,
    data_scanned_bytes: null,
    engine_execution_time_ms: null,
    query_queue_time_ms: null,
    ...overrides,
  };
}

beforeEach(() => {
  ddbMock.reset();
  vi.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("WarehouseJobRunsDao.putJobRun", () => {
  it("writes the run with gsi1 (recent-runs) and gsi2 (status) key attributes derived from it", async () => {
    ddbMock.on(PutCommand).resolves({});
    await dao.putJobRun(run({ status: "FAILED" }));

    const item = ddbMock.commandCalls(PutCommand)[0].args[0].input.Item as Record<string, unknown>;
    expect(item).toMatchObject({
      job_run_id: "01RUN",
      gsi1pk: "JOB#RUNS",
      gsi1sk: "2026-09-06T09:00:00.000Z",
      gsi2pk: "FAILED",
      gsi2sk: "2026-09-06T09:00:00.000Z",
    });
  });
});

describe("WarehouseJobRunsDao.listRecentJobRuns", () => {
  it("queries gsi1-recent-runs descending, capped at the limit", async () => {
    ddbMock.on(QueryCommand).resolves({ Items: [run(), run({ job_run_id: "02" })] });
    const rows = await dao.listRecentJobRuns(50);

    const input = ddbMock.commandCalls(QueryCommand)[0].args[0].input;
    expect(input).toMatchObject({
      IndexName: "gsi1-recent-runs",
      KeyConditionExpression: "gsi1pk = :pk",
      ExpressionAttributeValues: { ":pk": "JOB#RUNS" },
      ScanIndexForward: false,
      Limit: 50,
    });
    expect(rows).toHaveLength(2);
  });

  it("returns [] when the index is empty", async () => {
    ddbMock.on(QueryCommand).resolves({});
    expect(await dao.listRecentJobRuns(10)).toEqual([]);
  });
});

describe("WarehouseJobRunsDao.getLatestRunForJob", () => {
  it("filters by job_name and returns the first (most recent) match", async () => {
    ddbMock.on(QueryCommand).resolves({ Items: [run({ job_run_id: "latest" }), run({ job_run_id: "older" })] });
    const latest = await dao.getLatestRunForJob("order_volume_by_stage_7d");

    const input = ddbMock.commandCalls(QueryCommand)[0].args[0].input;
    expect(input).toMatchObject({
      IndexName: "gsi1-recent-runs",
      FilterExpression: "job_name = :jn",
      ExpressionAttributeValues: { ":pk": "JOB#RUNS", ":jn": "order_volume_by_stage_7d" },
      ScanIndexForward: false,
    });
    expect(latest?.job_run_id).toBe("latest");
  });

  it("returns null when the job has never run (empty page)", async () => {
    ddbMock.on(QueryCommand).resolves({ Items: [] });
    expect(await dao.getLatestRunForJob("order_volume_by_stage_7d")).toBeNull();
  });

  it("returns null when DynamoDB omits Items entirely", async () => {
    ddbMock.on(QueryCommand).resolves({});
    expect(await dao.getLatestRunForJob("order_volume_by_stage_7d")).toBeNull();
  });
});

describe("WarehouseJobRunsDao.getLatestSucceededRunForJob", () => {
  it("filters by job_name AND status = SUCCEEDED (with #status name placeholder), returns the first match", async () => {
    ddbMock.on(QueryCommand).resolves({
      Items: [
        run({ job_run_id: "ok", status: "SUCCEEDED", result_location: "s3://b/k" }),
        run({ job_run_id: "older-ok", status: "SUCCEEDED" }),
      ],
    });

    const latest = await dao.getLatestSucceededRunForJob("order_volume_by_stage_7d");

    const input = ddbMock.commandCalls(QueryCommand)[0].args[0].input;
    expect(input).toMatchObject({
      IndexName: "gsi1-recent-runs",
      FilterExpression: "job_name = :jn AND #status = :st",
      ExpressionAttributeNames: { "#status": "status" },
      ExpressionAttributeValues: { ":pk": "JOB#RUNS", ":jn": "order_volume_by_stage_7d", ":st": "SUCCEEDED" },
      ScanIndexForward: false,
      Limit: 100,
    });
    expect(latest?.job_run_id).toBe("ok");
  });

  it("returns null when the job has no succeeded run", async () => {
    ddbMock.on(QueryCommand).resolves({ Items: [] });
    expect(await dao.getLatestSucceededRunForJob("order_volume_by_stage_7d")).toBeNull();
  });

  it("returns null when the response omits Items entirely", async () => {
    /* Exercises the `result.Items ?? []` fallback — the `Items: []` case above always sets the key explicitly. */
    ddbMock.on(QueryCommand).resolves({});
    expect(await dao.getLatestSucceededRunForJob("order_volume_by_stage_7d")).toBeNull();
  });
});
