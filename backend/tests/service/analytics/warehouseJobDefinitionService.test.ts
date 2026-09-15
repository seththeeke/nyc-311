import { S3Client, DeleteObjectCommand, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import {
  SchedulerClient,
  CreateScheduleCommand,
  DeleteScheduleCommand,
  UpdateScheduleCommand,
} from "@aws-sdk/client-scheduler";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { mockClient } from "aws-sdk-client-mock";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createWarehouseJob,
  deleteWarehouseJob,
  listWarehouseJobs,
  updateWarehouseJob,
  getWarehouseJobSql,
} from "../../../service/analytics/warehouseJobDefinitionService";
import type { WarehouseJobDefinitionDeps } from "../../../service/analytics/warehouseJobDefinitionService";
import { NotFoundError, TerminalError } from "../../../models/errors";
import type { WarehouseJobRunsDao } from "../../../dao/analytics/warehouseJobRunsDao";
import type { WarehouseJobDefinition } from "../../../models/warehouseJobDefinition";

const s3Mock = mockClient(S3Client);
const s3Client = new S3Client({});
const schedulerMock = mockClient(SchedulerClient);
const schedulerClient = new SchedulerClient({});
const ddbMock = mockClient(DynamoDBDocumentClient);

const NOW = () => new Date("2026-09-13T19:04:11.000Z");

function definition(overrides: Partial<WarehouseJobDefinition> = {}): WarehouseJobDefinition {
  return {
    job_run_id: "DEF#order_volume_by_zip",
    record_type: "DEFINITION",
    job_name: "order_volume_by_zip",
    sql_s3_key: "job-definitions/order_volume_by_zip.sql",
    cadence_cron: "cron(0 9 * * ? *)",
    schedule_name: "Nyc311WarehouseJob-order_volume_by_zip-Test",
    created_at: "2026-09-13T19:04:11.000Z",
    created_by: "01ADMIN",
    ...overrides,
  };
}

function fakeDao(overrides: Partial<Record<keyof WarehouseJobRunsDao, unknown>> = {}): WarehouseJobRunsDao {
  return {
    putDefinition: vi.fn().mockResolvedValue(undefined),
    updateDefinition: vi.fn().mockResolvedValue(undefined),
    getDefinition: vi.fn().mockResolvedValue(definition()),
    deleteDefinition: vi.fn().mockResolvedValue(undefined),
    listDefinitions: vi.fn().mockResolvedValue([definition()]),
    ...overrides,
  } as unknown as WarehouseJobRunsDao;
}

const baseDeps = {
  s3Client,
  schedulerClient,
  warehouseBucket: "nyc311-warehouse-test",
  scheduleGroupName: "Nyc311WarehouseJobs-Test",
  scheduleRoleArn: "arn:aws:iam::123456789012:role/Nyc311WarehouseJobScheduleRole-Test",
  runnerFunctionArn: "arn:aws:lambda:us-east-1:123456789012:function:Nyc311WarehouseJobRunner-Test",
  deadLetterQueueArn: "arn:aws:sqs:us-east-1:123456789012:Nyc311WarehouseJobDlq-Test",
  envSuffix: "Test",
  now: NOW,
};

beforeEach(() => {
  s3Mock.reset();
  schedulerMock.reset();
  ddbMock.reset();
  s3Mock.on(PutObjectCommand).resolves({});
  s3Mock.on(DeleteObjectCommand).resolves({});
  schedulerMock.on(CreateScheduleCommand).resolves({});
  schedulerMock.on(DeleteScheduleCommand).resolves({});
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("createWarehouseJob", () => {
  it("writes the SQL to S3, then the DDB definition, then creates the schedule, in that order", async () => {
    const dao = fakeDao();

    const result = await createWarehouseJob(
      "order_volume_by_zip",
      "cron(0 9 * * ? *)",
      "SELECT zip, COUNT(*) FROM locations GROUP BY zip",
      "01ADMIN",
      { ...baseDeps, jobRunsDao: dao }
    );

    expect(result).toEqual(definition());

    const putObject = s3Mock.commandCalls(PutObjectCommand)[0].args[0].input;
    expect(putObject.Bucket).toBe("nyc311-warehouse-test");
    expect(putObject.Key).toBe("job-definitions/order_volume_by_zip.sql");
    expect(putObject.Body).toBe("SELECT zip, COUNT(*) FROM locations GROUP BY zip");

    expect(dao.putDefinition).toHaveBeenCalledWith(definition());

    const createSchedule = schedulerMock.commandCalls(CreateScheduleCommand)[0].args[0].input;
    expect(createSchedule).toMatchObject({
      Name: "Nyc311WarehouseJob-order_volume_by_zip-Test",
      GroupName: "Nyc311WarehouseJobs-Test",
      ScheduleExpression: "cron(0 9 * * ? *)",
      FlexibleTimeWindow: { Mode: "OFF" },
      Target: {
        Arn: "arn:aws:lambda:us-east-1:123456789012:function:Nyc311WarehouseJobRunner-Test",
        RoleArn: "arn:aws:iam::123456789012:role/Nyc311WarehouseJobScheduleRole-Test",
        Input: JSON.stringify({ job_name: "order_volume_by_zip" }),
        DeadLetterConfig: { Arn: "arn:aws:sqs:us-east-1:123456789012:Nyc311WarehouseJobDlq-Test" },
      },
    });
  });

  it("propagates a name-collision TerminalError from the DAO without creating a schedule", async () => {
    const dao = fakeDao({ putDefinition: vi.fn().mockRejectedValue(new TerminalError('A job named "x" already exists')) });

    await expect(
      createWarehouseJob("x", "cron(0 9 * * ? *)", "SELECT 1", "01ADMIN", { ...baseDeps, jobRunsDao: dao })
    ).rejects.toBeInstanceOf(TerminalError);
    expect(schedulerMock.calls()).toHaveLength(0);
  });

  it("throws a TerminalError naming the job when CreateSchedule fails after the definition was written", async () => {
    const dao = fakeDao();
    schedulerMock.on(CreateScheduleCommand).rejects(new Error("invalid cron expression"));

    await expect(
      createWarehouseJob("order_volume_by_zip", "cron(bad)", "SELECT 1", "01ADMIN", { ...baseDeps, jobRunsDao: dao })
    ).rejects.toThrow(/order_volume_by_zip/);
  });

  it("stamps created_at from the real clock when deps.now is not injected", async () => {
    const dao = fakeDao();
    const { now: _now, ...depsWithoutClock } = baseDeps;
    void _now;
    const before = Date.now();

    const result = await createWarehouseJob("order_volume_by_zip", "cron(0 9 * * ? *)", "SELECT 1", "01ADMIN", {
      ...(depsWithoutClock as WarehouseJobDefinitionDeps),
      jobRunsDao: dao,
    });

    const stamped = new Date(result.created_at).getTime();
    expect(stamped).toBeGreaterThanOrEqual(before);
    expect(stamped).toBeLessThanOrEqual(Date.now());
  });

  it("still throws a TerminalError when CreateSchedule rejects with a non-Error value", async () => {
    const dao = fakeDao();
    /* aws-sdk-client-mock's .rejects()/.callsFake() both normalize a thrown non-Error into a real Error —
     * spy directly on the client to exercise the `err instanceof Error ? ... : err` non-Error arm. */
    const sendSpy = vi.spyOn(schedulerClient, "send").mockRejectedValueOnce("raw string blow-up");

    await expect(
      createWarehouseJob("order_volume_by_zip", "cron(bad)", "SELECT 1", "01ADMIN", { ...baseDeps, jobRunsDao: dao })
    ).rejects.toThrow(TerminalError);
    sendSpy.mockRestore();
  });
});

describe("deleteWarehouseJob", () => {
  it("deletes the schedule, the S3 SQL file, and the DDB definition, in that order", async () => {
    const dao = fakeDao();

    await deleteWarehouseJob("order_volume_by_zip", { ...baseDeps, jobRunsDao: dao });

    expect(schedulerMock.commandCalls(DeleteScheduleCommand)[0].args[0].input).toEqual({
      Name: "Nyc311WarehouseJob-order_volume_by_zip-Test",
      GroupName: "Nyc311WarehouseJobs-Test",
    });
    expect(s3Mock.commandCalls(DeleteObjectCommand)[0].args[0].input).toMatchObject({
      Bucket: "nyc311-warehouse-test",
      Key: "job-definitions/order_volume_by_zip.sql",
    });
    expect(dao.deleteDefinition).toHaveBeenCalledWith("order_volume_by_zip");
  });

  it("throws NotFoundError when no job with this name exists, without touching the schedule/S3/DDB", async () => {
    const dao = fakeDao({ getDefinition: vi.fn().mockResolvedValue(null) });

    await expect(deleteWarehouseJob("ghost_job", { ...baseDeps, jobRunsDao: dao })).rejects.toBeInstanceOf(
      NotFoundError
    );
    expect(schedulerMock.calls()).toHaveLength(0);
    expect(s3Mock.calls()).toHaveLength(0);
  });

  it("tolerates an already-deleted schedule (ResourceNotFoundException)", async () => {
    const dao = fakeDao();
    const notFound = new Error("not found");
    notFound.name = "ResourceNotFoundException";
    schedulerMock.on(DeleteScheduleCommand).rejects(notFound);

    await deleteWarehouseJob("order_volume_by_zip", { ...baseDeps, jobRunsDao: dao });

    expect(dao.deleteDefinition).toHaveBeenCalledWith("order_volume_by_zip");
  });

  it("lets any other DeleteSchedule failure propagate", async () => {
    const dao = fakeDao();
    schedulerMock.on(DeleteScheduleCommand).rejects(new Error("access denied"));

    await expect(deleteWarehouseJob("order_volume_by_zip", { ...baseDeps, jobRunsDao: dao })).rejects.toThrow(
      "access denied"
    );
    expect(dao.deleteDefinition).not.toHaveBeenCalled();
  });

  it("lets a non-Error DeleteSchedule rejection propagate too", async () => {
    const dao = fakeDao();
    const sendSpy = vi.spyOn(schedulerClient, "send").mockRejectedValueOnce("raw string blow-up");

    await expect(deleteWarehouseJob("order_volume_by_zip", { ...baseDeps, jobRunsDao: dao })).rejects.toBe(
      "raw string blow-up"
    );
    expect(dao.deleteDefinition).not.toHaveBeenCalled();
    sendSpy.mockRestore();
  });
});

describe("listWarehouseJobs", () => {
  it("returns every definition from the DAO", async () => {
    const dao = fakeDao();
    expect(await listWarehouseJobs({ ...baseDeps, jobRunsDao: dao })).toEqual([definition()]);
  });
});

describe("updateWarehouseJob", () => {
  it("overwrites the S3 SQL file, updates the schedule, and updates the DDB row, in that order", async () => {
    const dao = fakeDao();

    const updated = await updateWarehouseJob(
      "order_volume_by_zip",
      "cron(0 10 * * ? *)",
      "SELECT 2",
      { ...baseDeps, jobRunsDao: dao }
    );

    expect(s3Mock.commandCalls(PutObjectCommand)[0].args[0].input).toMatchObject({
      Bucket: "nyc311-warehouse-test",
      Key: "job-definitions/order_volume_by_zip.sql",
      Body: "SELECT 2",
    });
    expect(schedulerMock.commandCalls(UpdateScheduleCommand)[0].args[0].input).toMatchObject({
      Name: "Nyc311WarehouseJob-order_volume_by_zip-Test",
      GroupName: "Nyc311WarehouseJobs-Test",
      ScheduleExpression: "cron(0 10 * * ? *)",
    });
    expect(dao.updateDefinition).toHaveBeenCalledWith({ ...definition(), cadence_cron: "cron(0 10 * * ? *)" });
    expect(updated).toEqual({ ...definition(), cadence_cron: "cron(0 10 * * ? *)" });
  });

  it("throws NotFoundError when no job with this name exists, without touching S3/scheduler/DDB", async () => {
    const dao = fakeDao({ getDefinition: vi.fn().mockResolvedValue(null) });

    await expect(
      updateWarehouseJob("ghost_job", "cron(0 10 * * ? *)", "SELECT 2", { ...baseDeps, jobRunsDao: dao })
    ).rejects.toBeInstanceOf(NotFoundError);
    expect(s3Mock.calls()).toHaveLength(0);
    expect(schedulerMock.calls()).toHaveLength(0);
    expect(dao.updateDefinition).not.toHaveBeenCalled();
  });

  it("throws TerminalError naming the job when the schedule update fails, without touching the DDB row", async () => {
    const dao = fakeDao();
    schedulerMock.on(UpdateScheduleCommand).rejects(new Error("access denied"));

    await expect(
      updateWarehouseJob("order_volume_by_zip", "cron(0 10 * * ? *)", "SELECT 2", { ...baseDeps, jobRunsDao: dao })
    ).rejects.toThrow(/order_volume_by_zip/);
    expect(dao.updateDefinition).not.toHaveBeenCalled();
  });
});

describe("getWarehouseJobSql", () => {
  it("reads the definition's SQL text from its S3 key", async () => {
    const dao = fakeDao();
    s3Mock.on(GetObjectCommand).resolves({ Body: { transformToString: async () => "SELECT 1" } } as never);

    const sql = await getWarehouseJobSql("order_volume_by_zip", { ...baseDeps, jobRunsDao: dao });

    expect(s3Mock.commandCalls(GetObjectCommand)[0].args[0].input).toMatchObject({
      Bucket: "nyc311-warehouse-test",
      Key: "job-definitions/order_volume_by_zip.sql",
    });
    expect(sql).toBe("SELECT 1");
  });

  it("returns an empty string when the S3 response has no Body", async () => {
    const dao = fakeDao();
    s3Mock.on(GetObjectCommand).resolves({});

    expect(await getWarehouseJobSql("order_volume_by_zip", { ...baseDeps, jobRunsDao: dao })).toBe("");
  });

  it("throws NotFoundError when no job with this name exists", async () => {
    const dao = fakeDao({ getDefinition: vi.fn().mockResolvedValue(null) });

    await expect(getWarehouseJobSql("ghost_job", { ...baseDeps, jobRunsDao: dao })).rejects.toBeInstanceOf(
      NotFoundError
    );
  });
});

describe("environment resolution", () => {
  const ENV_VARS = {
    WAREHOUSE_JOB_RUNS_TABLE_NAME: "WarehouseJobRuns-Test",
    JOB_RESULTS_BUCKET: "nyc311-warehouse-test",
    SCHEDULER_GROUP_NAME: "Nyc311WarehouseJobs-Test",
    SCHEDULER_ROLE_ARN: "arn:aws:iam::123456789012:role/Nyc311WarehouseJobScheduleRole-Test",
    WAREHOUSE_JOB_RUNNER_FUNCTION_ARN: "arn:aws:lambda:us-east-1:123456789012:function:Nyc311WarehouseJobRunner-Test",
    WAREHOUSE_JOB_DLQ_ARN: "arn:aws:sqs:us-east-1:123456789012:Nyc311WarehouseJobDlq-Test",
    WAREHOUSE_JOB_ENV_SUFFIX: "Test",
  } as const;

  function withEnv(overrides: Partial<Record<keyof typeof ENV_VARS, string | undefined>> = {}): () => void {
    const saved: Record<string, string | undefined> = {};
    const merged = { ...ENV_VARS, ...overrides };
    for (const [k, v] of Object.entries(merged)) {
      saved[k] = process.env[k];
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
    return () => {
      for (const [k, v] of Object.entries(saved)) {
        if (v === undefined) delete process.env[k];
        else process.env[k] = v;
      }
    };
  }

  it.each(Object.keys(ENV_VARS))("throws a clear error when %s is missing and nothing is injected", async (missing) => {
    const restore = withEnv({ [missing]: undefined } as Partial<Record<keyof typeof ENV_VARS, undefined>>);
    try {
      await expect(listWarehouseJobs()).rejects.toThrow(`Missing required environment variable: ${missing}`);
    } finally {
      restore();
    }
  });

  it("resolves every dependency (clients, table name, clock) from the environment when deps is fully empty", async () => {
    const restore = withEnv();
    try {
      ddbMock.on(QueryCommand).resolves({ Items: [definition()] });

      const jobs = await listWarehouseJobs();

      expect(jobs).toEqual([definition()]);
    } finally {
      restore();
    }
  });
});
