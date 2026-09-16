import { ConditionalCheckFailedException, DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DeleteCommand, DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { mockClient } from "aws-sdk-client-mock";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WarehouseJobRunsDao } from "../../../dao/analytics/warehouseJobRunsDao";
import { TerminalError } from "../../../models/errors";
import type { WarehouseJobRun } from "../../../models/warehouseJobRun";
import type { WarehouseJobDefinition } from "../../../models/warehouseJobDefinition";

const ddbMock = mockClient(DynamoDBDocumentClient);
const dao = new WarehouseJobRunsDao(DynamoDBDocumentClient.from(new DynamoDBClient({})), "WarehouseJobRuns-Test");

function definition(overrides: Partial<WarehouseJobDefinition> = {}): WarehouseJobDefinition {
  return {
    job_run_id: "DEF#order_volume_by_borough",
    record_type: "DEFINITION",
    job_name: "order_volume_by_borough",
    sql_s3_key: "job-definitions/order_volume_by_borough.sql",
    job_type: "SCHEDULED",
    cadence_cron: "cron(0 9 * * ? *)",
    schedule_name: "Nyc311WarehouseJob-order_volume_by_borough-Test",
    created_at: "2026-09-13T00:00:00.000Z",
    created_by: "01ADMIN",
    ...overrides,
  };
}

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

describe("WarehouseJobRunsDao.putDefinition", () => {
  it("writes the definition with gsi1 (JOB#DEFINITIONS) key attributes and a name-uniqueness condition", async () => {
    ddbMock.on(PutCommand).resolves({});
    await dao.putDefinition(definition());

    const call = ddbMock.commandCalls(PutCommand)[0].args[0].input;
    expect(call.Item).toMatchObject({
      job_run_id: "DEF#order_volume_by_borough",
      record_type: "DEFINITION",
      gsi1pk: "JOB#DEFINITIONS",
      gsi1sk: "2026-09-13T00:00:00.000Z",
    });
    expect(call.ConditionExpression).toBe("attribute_not_exists(job_run_id)");
  });

  it("throws TerminalError naming the job when the name already exists", async () => {
    ddbMock.on(PutCommand).rejects(new ConditionalCheckFailedException({ message: "check failed", $metadata: {} }));

    await expect(dao.putDefinition(definition())).rejects.toBeInstanceOf(TerminalError);
    await expect(dao.putDefinition(definition())).rejects.toThrow(/order_volume_by_borough/);
  });

  it("lets any other PutCommand failure propagate", async () => {
    ddbMock.on(PutCommand).rejects(new Error("DynamoDB unavailable"));
    await expect(dao.putDefinition(definition())).rejects.toThrow("DynamoDB unavailable");
  });
});

describe("WarehouseJobRunsDao.updateDefinition", () => {
  it("writes the definition with gsi1 (JOB#DEFINITIONS) key attributes and no uniqueness condition", async () => {
    ddbMock.on(PutCommand).resolves({});
    await dao.updateDefinition(definition({ cadence_cron: "cron(0 10 * * ? *)" }));

    const call = ddbMock.commandCalls(PutCommand)[0].args[0].input;
    expect(call.Item).toMatchObject({
      job_run_id: "DEF#order_volume_by_borough",
      record_type: "DEFINITION",
      cadence_cron: "cron(0 10 * * ? *)",
      gsi1pk: "JOB#DEFINITIONS",
      gsi1sk: "2026-09-13T00:00:00.000Z",
    });
    expect(call.ConditionExpression).toBeUndefined();
  });
});

describe("WarehouseJobRunsDao.getDefinition", () => {
  it("gets by the DEF#<name> key and validates the result", async () => {
    ddbMock.on(GetCommand).resolves({ Item: definition() });
    const result = await dao.getDefinition("order_volume_by_borough");

    expect(ddbMock.commandCalls(GetCommand)[0].args[0].input.Key).toEqual({
      job_run_id: "DEF#order_volume_by_borough",
    });
    expect(result).toEqual(definition());
  });

  it("returns null when no definition exists", async () => {
    ddbMock.on(GetCommand).resolves({});
    expect(await dao.getDefinition("ghost_job")).toBeNull();
  });
});

describe("WarehouseJobRunsDao.deleteDefinition", () => {
  it("deletes by the DEF#<name> key", async () => {
    ddbMock.on(DeleteCommand).resolves({});
    await dao.deleteDefinition("order_volume_by_borough");

    expect(ddbMock.commandCalls(DeleteCommand)[0].args[0].input.Key).toEqual({
      job_run_id: "DEF#order_volume_by_borough",
    });
  });
});

describe("WarehouseJobRunsDao.listDefinitions", () => {
  it("queries gsi1-recent-runs on JOB#DEFINITIONS, most-recently-created first", async () => {
    ddbMock.on(QueryCommand).resolves({ Items: [definition(), definition({ job_name: "order_volume_by_zip" })] });
    const defs = await dao.listDefinitions();

    const input = ddbMock.commandCalls(QueryCommand)[0].args[0].input;
    expect(input).toMatchObject({
      IndexName: "gsi1-recent-runs",
      KeyConditionExpression: "gsi1pk = :pk",
      ExpressionAttributeValues: { ":pk": "JOB#DEFINITIONS" },
      ScanIndexForward: false,
    });
    expect(defs).toHaveLength(2);
  });

  it("returns [] when there are no definitions", async () => {
    ddbMock.on(QueryCommand).resolves({});
    expect(await dao.listDefinitions()).toEqual([]);
  });
});
