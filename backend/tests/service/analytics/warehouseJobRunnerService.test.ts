import {
  AthenaClient,
  StartQueryExecutionCommand,
  GetQueryExecutionCommand,
  GetQueryResultsCommand,
} from "@aws-sdk/client-athena";
import { S3Client, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { mockClient } from "aws-sdk-client-mock";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runWarehouseJob } from "../../../service/analytics/warehouseJobRunnerService";
import { NotFoundError } from "../../../models/errors";
import type { WarehouseJobRunsDao } from "../../../dao/analytics/warehouseJobRunsDao";
import type { WarehouseJobRun } from "../../../models/warehouseJobRun";
import type { WarehouseJobDefinition } from "../../../models/warehouseJobDefinition";

const athenaMock = mockClient(AthenaClient);
const athenaClient = new AthenaClient({});
const s3Mock = mockClient(S3Client);
const s3Client = new S3Client({});
const ddbMock = mockClient(DynamoDBDocumentClient);

const JOB_NAME = "order_volume_by_stage_7d";
const JOB_SQL = "SELECT created_date, stage, count(*) FROM order_snapshots";

const RUNNER_ENV = {
  WAREHOUSE_JOB_RUNS_TABLE_NAME: "WarehouseJobRuns-Test",
  JOB_RESULTS_BUCKET: "nyc311-warehouse-test",
  WAREHOUSE_DATABASE_NAME: "nyc311_warehouse_test",
  ATHENA_WORKGROUP: "Nyc311Analytics-Test",
} as const;

function withRunnerEnv(overrides: Partial<Record<keyof typeof RUNNER_ENV, string | undefined>> = {}): () => void {
  const saved: Record<string, string | undefined> = {};
  const merged = { ...RUNNER_ENV, ...overrides };
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

const NOW = () => new Date("2026-09-07T09:00:00.000Z");

function definition(overrides: Partial<WarehouseJobDefinition> = {}): WarehouseJobDefinition {
  return {
    job_run_id: `DEF#${JOB_NAME}`,
    record_type: "DEFINITION",
    job_name: JOB_NAME,
    sql_s3_key: `job-definitions/${JOB_NAME}.sql`,
    job_type: "SCHEDULED",
    cadence_cron: "cron(0 9 * * ? *)",
    schedule_name: `Nyc311WarehouseJob-${JOB_NAME}-Test`,
    created_at: "2026-09-01T00:00:00.000Z",
    created_by: "01ADMIN",
    ...overrides,
  };
}

function fakeJobRunsDao(latest: WarehouseJobRun | null = null, def: WarehouseJobDefinition | null = definition()): {
  dao: WarehouseJobRunsDao;
  puts: WarehouseJobRun[];
} {
  const puts: WarehouseJobRun[] = [];
  const dao = {
    getLatestRunForJob: vi.fn().mockResolvedValue(latest),
    getDefinition: vi.fn().mockResolvedValue(def),
    putJobRun: vi.fn().mockImplementation(async (r: WarehouseJobRun) => {
      puts.push(r);
    }),
  } as unknown as WarehouseJobRunsDao;
  return { dao, puts };
}

function completedRun(overrides: Partial<WarehouseJobRun>): WarehouseJobRun {
  return {
    job_run_id: "01OLD",
    job_name: JOB_NAME,
    status: "SUCCEEDED",
    trigger: "SCHEDULED",
    started_at: "2026-09-06T09:00:00.000Z",
    completed_at: "2026-09-06T09:00:10.000Z",
    execution_ref: "q-old",
    result_location: "s3://b/k",
    row_count: 21,
    error_message: null,
    retry_count: 0,
    retried_from_job_run_id: null,
    data_scanned_bytes: 100,
    engine_execution_time_ms: 900,
    query_queue_time_ms: 10,
    ...overrides,
  };
}

beforeEach(() => {
  athenaMock.reset();
  s3Mock.reset();
  ddbMock.reset();
  s3Mock.on(PutObjectCommand).resolves({});
  s3Mock.on(GetObjectCommand).resolves({ Body: { transformToString: async () => JOB_SQL } } as never);
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

interface AthenaSuccessOpts {
  columns?: [string, string][];
  rows?: string[][];
  stats?: { scanned?: number; engine?: number; queue?: number };
  queryExecutionId?: string | null;
}

function mockAthenaSuccess({
  columns = [
    ["created_date", "varchar"],
    ["stage", "varchar"],
    ["order_count", "bigint"],
  ],
  rows = [["2026-09-01", "SCHEDULE", "8830"]],
  stats = { scanned: 2048, engine: 1500, queue: 30 },
  queryExecutionId = "q-123",
}: AthenaSuccessOpts = {}): void {
  athenaMock
    .on(StartQueryExecutionCommand)
    .resolves(queryExecutionId === null ? {} : { QueryExecutionId: queryExecutionId });
  athenaMock.on(GetQueryExecutionCommand).resolves({
    QueryExecution: {
      Status: { State: "SUCCEEDED" },
      Statistics:
        stats.scanned === undefined
          ? undefined
          : {
              DataScannedInBytes: stats.scanned,
              EngineExecutionTimeInMillis: stats.engine,
              QueryQueueTimeInMillis: stats.queue,
            },
    },
  });
  athenaMock.on(GetQueryResultsCommand).resolves({
    ResultSet: {
      ResultSetMetadata: { ColumnInfo: columns.map(([Name, Type]) => ({ Name, Type })) },
      Rows: [
        { Data: columns.map(([Name]) => ({ VarCharValue: Name })) },
        ...rows.map((row) => ({ Data: row.map((v) => ({ VarCharValue: v })) })),
      ],
    },
  });
}

const baseDeps = {
  athenaClient,
  s3Client,
  resultsBucket: "nyc311-warehouse-test",
  database: "nyc311_warehouse_test",
  workgroup: "Nyc311Analytics-Test",
  now: NOW,
  sleep: async () => {},
};

function lastPutBody(): Record<string, unknown> {
  const call = s3Mock.commandCalls(PutObjectCommand).at(-1);
  return JSON.parse(call!.args[0].input.Body as string) as Record<string, unknown>;
}

describe("runWarehouseJob", () => {
  it("first-ever run: RUNNING then SUCCEEDED with stats, writes the resultset envelope to S3, records result_location/row_count", async () => {
    const jobRuns = fakeJobRunsDao();
    mockAthenaSuccess({
      rows: [
        ["2026-09-01", "SCHEDULE", "8830"],
        ["2026-09-01", "INGEST", "4918"],
      ],
    });

    const run = await runWarehouseJob(JOB_NAME, { ...baseDeps, jobRunsDao: jobRuns.dao });

    expect(run.status).toBe("SUCCEEDED");
    expect(jobRuns.puts[0]).toMatchObject({ status: "RUNNING", trigger: "SCHEDULED", retry_count: 0 });
    expect(jobRuns.puts[1]).toMatchObject({
      status: "SUCCEEDED",
      execution_ref: "q-123",
      data_scanned_bytes: 2048,
      engine_execution_time_ms: 1500,
      query_queue_time_ms: 30,
      row_count: 2,
      result_location: `s3://nyc311-warehouse-test/job-results/job_name=${JOB_NAME}/run_date=2026-09-07/result.json`,
    });

    const put = s3Mock.commandCalls(PutObjectCommand)[0].args[0].input;
    expect(put.Bucket).toBe("nyc311-warehouse-test");
    expect(put.Key).toBe(`job-results/job_name=${JOB_NAME}/run_date=2026-09-07/result.json`);
    expect(put.ContentType).toBe("application/json");

    expect(lastPutBody()).toEqual({
      job_name: JOB_NAME,
      job_run_id: expect.any(String),
      run_date: "2026-09-07",
      computed_at: "2026-09-07T09:00:00.000Z",
      columns: [
        { name: "created_date", type: "varchar" },
        { name: "stage", type: "varchar" },
        { name: "order_count", type: "bigint" },
      ],
      rows: [
        { created_date: "2026-09-01", stage: "SCHEDULE", order_count: "8830" },
        { created_date: "2026-09-01", stage: "INGEST", order_count: "4918" },
      ],
    });

    const get = s3Mock.commandCalls(GetObjectCommand)[0].args[0].input;
    expect(get.Bucket).toBe("nyc311-warehouse-test");
    expect(get.Key).toBe(`job-definitions/${JOB_NAME}.sql`);
  });

  it("throws NotFoundError when the job's definition doesn't exist, without writing any run row", async () => {
    const jobRuns = fakeJobRunsDao(null, null);

    await expect(runWarehouseJob("ghost_job", { ...baseDeps, jobRunsDao: jobRuns.dao })).rejects.toBeInstanceOf(
      NotFoundError
    );
    expect(jobRuns.puts).toHaveLength(0);
  });

  it("treats a job as a RETRY when its last run FAILED and retries aren't exhausted", async () => {
    const jobRuns = fakeJobRunsDao(completedRun({ job_run_id: "01OLD", status: "FAILED", retry_count: 1 }));
    mockAthenaSuccess();

    await runWarehouseJob(JOB_NAME, { ...baseDeps, jobRunsDao: jobRuns.dao });

    expect(jobRuns.puts[0]).toMatchObject({
      status: "RUNNING",
      trigger: "RETRY",
      retry_count: 2,
      retried_from_job_run_id: "01OLD",
    });
  });

  it("does NOT retry once MAX_JOB_RETRIES is hit — a fresh SCHEDULED run", async () => {
    const jobRuns = fakeJobRunsDao(completedRun({ status: "FAILED", retry_count: 3 }));
    mockAthenaSuccess();

    await runWarehouseJob(JOB_NAME, { ...baseDeps, jobRunsDao: jobRuns.dao });

    expect(jobRuns.puts[0]).toMatchObject({ trigger: "SCHEDULED", retry_count: 0 });
  });

  it("a SUCCEEDED last run means a fresh SCHEDULED run", async () => {
    const jobRuns = fakeJobRunsDao(completedRun({ status: "SUCCEEDED" }));
    mockAthenaSuccess();

    await runWarehouseJob(JOB_NAME, { ...baseDeps, jobRunsDao: jobRuns.dao });

    expect(jobRuns.puts[0]).toMatchObject({ trigger: "SCHEDULED", retry_count: 0 });
  });

  it("a job's own SQL failure is recorded FAILED and does not throw", async () => {
    const jobRuns = fakeJobRunsDao();
    athenaMock.on(StartQueryExecutionCommand).resolves({ QueryExecutionId: "q-a" });
    athenaMock
      .on(GetQueryExecutionCommand)
      .resolves({ QueryExecution: { Status: { State: "FAILED", StateChangeReason: "SYNTAX_ERROR: bad column" } } });

    const run = await runWarehouseJob(JOB_NAME, { ...baseDeps, jobRunsDao: jobRuns.dao });

    expect(run.status).toBe("FAILED");
    expect(run.error_message).toContain("SYNTAX_ERROR");
    expect(s3Mock.commandCalls(PutObjectCommand)).toHaveLength(0);
  });

  it("Athena CANCELLED with no reason → job recorded FAILED with 'unknown'", async () => {
    const jobRuns = fakeJobRunsDao();
    athenaMock.on(StartQueryExecutionCommand).resolves({ QueryExecutionId: "q-c" });
    athenaMock.on(GetQueryExecutionCommand).resolves({ QueryExecution: { Status: { State: "CANCELLED" } } });

    const run = await runWarehouseJob(JOB_NAME, { ...baseDeps, jobRunsDao: jobRuns.dao });

    expect(run.status).toBe("FAILED");
    expect(run.error_message).toBe("Athena query CANCELLED: unknown");
  });

  it("tolerates a missing QueryExecutionId, absent Statistics and an empty ResultSet", async () => {
    const jobRuns = fakeJobRunsDao();
    athenaMock.on(StartQueryExecutionCommand).resolves({});
    athenaMock.on(GetQueryExecutionCommand).resolves({ QueryExecution: { Status: { State: "SUCCEEDED" } } });
    athenaMock.on(GetQueryResultsCommand).resolves({});

    const run = await runWarehouseJob(JOB_NAME, { ...baseDeps, jobRunsDao: jobRuns.dao });

    expect(run).toMatchObject({
      status: "SUCCEEDED",
      execution_ref: "",
      row_count: 0,
      data_scanned_bytes: null,
      engine_execution_time_ms: null,
      query_queue_time_ms: null,
    });
    expect(lastPutBody()).toMatchObject({ columns: [], rows: [] });
  });

  it("polls while the query is RUNNING, then completes on SUCCEEDED; missing row cells default to empty string", async () => {
    const jobRuns = fakeJobRunsDao();
    const sleep = vi.fn().mockResolvedValue(undefined);
    athenaMock.on(StartQueryExecutionCommand).resolves({ QueryExecutionId: "q-poll" });
    athenaMock
      .on(GetQueryExecutionCommand)
      .resolvesOnce({ QueryExecution: { Status: { State: "RUNNING" } } })
      .resolves({
        QueryExecution: {
          Status: { State: "SUCCEEDED" },
          Statistics: { DataScannedInBytes: 1, EngineExecutionTimeInMillis: 1, QueryQueueTimeInMillis: 1 },
        },
      });
    athenaMock.on(GetQueryResultsCommand).resolves({
      ResultSet: {
        ResultSetMetadata: { ColumnInfo: [{ Name: "a", Type: "varchar" }, { Name: "b", Type: "varchar" }] },
        Rows: [{ Data: [{ VarCharValue: "a" }, { VarCharValue: "b" }] }, { Data: [{}] }, {}],
      },
    });

    const run = await runWarehouseJob(JOB_NAME, { ...baseDeps, sleep, jobRunsDao: jobRuns.dao });

    expect(run.status).toBe("SUCCEEDED");
    expect(sleep).toHaveBeenCalledWith(2_000);
    expect(athenaMock.commandCalls(GetQueryExecutionCommand).length).toBeGreaterThanOrEqual(2);
    expect(lastPutBody().rows).toEqual([
      { a: "", b: "" },
      { a: "", b: "" },
    ]);
  });

  it("defaults a column's name/type to empty string when Athena omits them", async () => {
    const jobRuns = fakeJobRunsDao();
    mockAthenaSuccess();
    athenaMock.on(GetQueryResultsCommand).resolves({
      ResultSet: {
        ResultSetMetadata: { ColumnInfo: [{}] },
        Rows: [{ Data: [{ VarCharValue: "x" }] }],
      },
    } as never);

    await runWarehouseJob(JOB_NAME, { ...baseDeps, jobRunsDao: jobRuns.dao });

    expect(lastPutBody().columns).toEqual([{ name: "", type: "" }]);
  });

  it("stringifies a non-Error failure into error_message, records FAILED, does not throw", async () => {
    const jobRuns = fakeJobRunsDao();
    mockAthenaSuccess();
    /* aws-sdk-client-mock's `.rejects(string)` wraps it in a real Error, which wouldn't exercise the
     * `err instanceof Error ? ... : String(err)` non-Error arm — spy directly to reject with a bare string. */
    const sendSpy = vi.spyOn(s3Client, "send").mockImplementation(async (command) => {
      if (command instanceof PutObjectCommand) throw "raw string blow-up";
      return { Body: { transformToString: async () => JOB_SQL } } as never;
    });

    const run = await runWarehouseJob(JOB_NAME, { ...baseDeps, jobRunsDao: jobRuns.dao });

    expect(run).toMatchObject({ status: "FAILED", error_message: "raw string blow-up" });
    sendSpy.mockRestore();
  });

  it("times out and records the run FAILED if the query never leaves RUNNING", async () => {
    const jobRuns = fakeJobRunsDao();
    athenaMock.on(StartQueryExecutionCommand).resolves({ QueryExecutionId: "q-hang" });
    athenaMock.on(GetQueryExecutionCommand).resolves({ QueryExecution: { Status: { State: "RUNNING" } } });

    const run = await runWarehouseJob(JOB_NAME, { ...baseDeps, jobRunsDao: jobRuns.dao });

    expect(run).toMatchObject({ status: "FAILED", error_message: expect.stringContaining("timed out") });
  });

  it("resolves every dependency (clients, table name, clock, sleep) from the environment when deps is empty", async () => {
    const restore = withRunnerEnv();
    try {
      ddbMock.on(GetCommand).resolves({ Item: definition() });
      ddbMock.on(QueryCommand).resolves({ Items: [] });
      ddbMock.on(PutCommand).resolves({});
      mockAthenaSuccess();

      const run = await runWarehouseJob(JOB_NAME);

      expect(run.status).toBe("SUCCEEDED");
      expect(run.job_name).toBe(JOB_NAME);
      expect(s3Mock.commandCalls(PutObjectCommand)).toHaveLength(1);
    } finally {
      restore();
    }
  });

  it("throws a clear error when a required env var is missing and nothing is injected", async () => {
    const restore = withRunnerEnv({ WAREHOUSE_DATABASE_NAME: undefined });
    try {
      await expect(runWarehouseJob(JOB_NAME, { athenaClient, s3Client, now: NOW })).rejects.toThrow(
        "Missing required environment variable: WAREHOUSE_DATABASE_NAME"
      );
    } finally {
      restore();
    }
  });
});
