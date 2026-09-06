import {
  AthenaClient,
  StartQueryExecutionCommand,
  GetQueryExecutionCommand,
  GetQueryResultsCommand,
} from "@aws-sdk/client-athena";
import { DynamoDBDocumentClient, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { mockClient } from "aws-sdk-client-mock";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runSampleWarehouseJob } from "../../../service/analytics/warehouseJobRunnerService";
import type { WarehouseJobRunsDao } from "../../../dao/analytics/warehouseJobRunsDao";
import type { AnalyticsRollupsDao } from "../../../dao/analytics/analyticsRollupsDao";
import type { WarehouseJobRun } from "../../../models/warehouseJobRun";

const athenaMock = mockClient(AthenaClient);
const athenaClient = new AthenaClient({});
const ddbMock = mockClient(DynamoDBDocumentClient);

const RUNNER_ENV = {
  WAREHOUSE_JOB_RUNS_TABLE_NAME: "WarehouseJobRuns-Test",
  ANALYTICS_ROLLUPS_TABLE_NAME: "AnalyticsRollups-Test",
  SAMPLE_JOB_SQL: "SELECT 1",
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

const NOW = () => new Date("2026-09-06T09:00:00.000Z");

function fakeJobRunsDao(latest: WarehouseJobRun | null): {
  dao: WarehouseJobRunsDao;
  puts: WarehouseJobRun[];
} {
  const puts: WarehouseJobRun[] = [];
  const dao = {
    getLatestRunForJob: vi.fn().mockResolvedValue(latest),
    putJobRun: vi.fn().mockImplementation(async (r: WarehouseJobRun) => {
      puts.push(r);
    }),
    listRecentJobRuns: vi.fn(),
  } as unknown as WarehouseJobRunsDao;
  return { dao, puts };
}

function fakeRollupsDao(): { dao: AnalyticsRollupsDao; puts: unknown[] } {
  const puts: unknown[] = [];
  const dao = {
    putRollup: vi.fn().mockImplementation(async (r: unknown) => {
      puts.push(r);
    }),
    listRollups: vi.fn(),
  } as unknown as AnalyticsRollupsDao;
  return { dao, puts };
}

function completedRun(overrides: Partial<WarehouseJobRun>): WarehouseJobRun {
  return {
    job_run_id: "01OLD",
    job_name: "ORDER_VOLUME_BY_STAGE",
    status: "SUCCEEDED",
    trigger: "SCHEDULED",
    started_at: "2026-09-05T09:00:00.000Z",
    completed_at: "2026-09-05T09:00:10.000Z",
    execution_ref: "q-old",
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
  ddbMock.reset();
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

function mockAthenaSuccess(rows: [string, string][]): void {
  athenaMock.on(StartQueryExecutionCommand).resolves({ QueryExecutionId: "q-123" });
  athenaMock.on(GetQueryExecutionCommand).resolves({
    QueryExecution: {
      Status: { State: "SUCCEEDED" },
      Statistics: { DataScannedInBytes: 2048, EngineExecutionTimeInMillis: 1500, QueryQueueTimeInMillis: 30 },
    },
  });
  athenaMock.on(GetQueryResultsCommand).resolves({
    ResultSet: {
      Rows: [
        { Data: [{ VarCharValue: "dimension" }, { VarCharValue: "value" }] },
        ...rows.map(([d, v]) => ({ Data: [{ VarCharValue: d }, { VarCharValue: v }] })),
      ],
    },
  });
}

const baseDeps = {
  athenaClient,
  sql: "SELECT 1",
  database: "nyc311_warehouse_test",
  workgroup: "Nyc311Analytics-Test",
  now: NOW,
  sleep: async () => {},
};

describe("runSampleWarehouseJob", () => {
  it("first-ever run: SCHEDULED, writes RUNNING then SUCCEEDED with the query's stats, and folds rows into rollups", async () => {
    const jobRuns = fakeJobRunsDao(null);
    const rollups = fakeRollupsDao();
    mockAthenaSuccess([
      ["INGEST", "5"],
      ["SCHEDULE", "12"],
    ]);

    const result = await runSampleWarehouseJob({ ...baseDeps, jobRunsDao: jobRuns.dao, rollupsDao: rollups.dao });

    expect(jobRuns.puts[0]).toMatchObject({ status: "RUNNING", trigger: "SCHEDULED", retry_count: 0 });
    expect(jobRuns.puts[1]).toMatchObject({
      status: "SUCCEEDED",
      execution_ref: "q-123",
      data_scanned_bytes: 2048,
      engine_execution_time_ms: 1500,
      query_queue_time_ms: 30,
    });
    expect(result.status).toBe("SUCCEEDED");
    expect(rollups.puts).toHaveLength(2);
    expect(rollups.puts[0]).toMatchObject({
      metric_view: "ORDER_VOLUME_BY_STAGE",
      rollup_key: "2026-09-06#INGEST",
      run_date: "2026-09-06",
      dimension: "INGEST",
      value: 5,
    });
  });

  it("treats itself as a RETRY when the last run FAILED and retries aren't exhausted", async () => {
    const jobRuns = fakeJobRunsDao(completedRun({ job_run_id: "01OLD", status: "FAILED", retry_count: 1 }));
    const rollups = fakeRollupsDao();
    mockAthenaSuccess([["INGEST", "1"]]);

    await runSampleWarehouseJob({ ...baseDeps, jobRunsDao: jobRuns.dao, rollupsDao: rollups.dao });

    expect(jobRuns.puts[0]).toMatchObject({
      status: "RUNNING",
      trigger: "RETRY",
      retry_count: 2,
      retried_from_job_run_id: "01OLD",
    });
  });

  it("does NOT retry once MAX_JOB_RETRIES is hit — a fresh SCHEDULED run instead", async () => {
    const jobRuns = fakeJobRunsDao(completedRun({ status: "FAILED", retry_count: 3 }));
    const rollups = fakeRollupsDao();
    mockAthenaSuccess([["INGEST", "1"]]);

    await runSampleWarehouseJob({ ...baseDeps, jobRunsDao: jobRuns.dao, rollupsDao: rollups.dao });

    expect(jobRuns.puts[0]).toMatchObject({ trigger: "SCHEDULED", retry_count: 0 });
  });

  it("a SUCCEEDED last run means a fresh SCHEDULED run, not a retry", async () => {
    const jobRuns = fakeJobRunsDao(completedRun({ status: "SUCCEEDED" }));
    const rollups = fakeRollupsDao();
    mockAthenaSuccess([["INGEST", "1"]]);

    await runSampleWarehouseJob({ ...baseDeps, jobRunsDao: jobRuns.dao, rollupsDao: rollups.dao });

    expect(jobRuns.puts[0]).toMatchObject({ trigger: "SCHEDULED", retry_count: 0 });
  });

  it("on an Athena FAILED state: writes the run FAILED with the reason, then rethrows", async () => {
    const jobRuns = fakeJobRunsDao(null);
    const rollups = fakeRollupsDao();
    athenaMock.on(StartQueryExecutionCommand).resolves({ QueryExecutionId: "q-x" });
    athenaMock.on(GetQueryExecutionCommand).resolves({
      QueryExecution: { Status: { State: "FAILED", StateChangeReason: "SYNTAX_ERROR: bad column" } },
    });

    await expect(
      runSampleWarehouseJob({ ...baseDeps, jobRunsDao: jobRuns.dao, rollupsDao: rollups.dao })
    ).rejects.toThrow("SYNTAX_ERROR");

    expect(jobRuns.puts[jobRuns.puts.length - 1]).toMatchObject({
      status: "FAILED",
      error_message: expect.stringContaining("SYNTAX_ERROR"),
    });
    expect(rollups.puts).toHaveLength(0);
  });

  it("on an Athena CANCELLED state with no reason: throws with 'unknown'", async () => {
    const jobRuns = fakeJobRunsDao(null);
    const rollups = fakeRollupsDao();
    athenaMock.on(StartQueryExecutionCommand).resolves({ QueryExecutionId: "q-c" });
    athenaMock.on(GetQueryExecutionCommand).resolves({ QueryExecution: { Status: { State: "CANCELLED" } } });

    await expect(
      runSampleWarehouseJob({ ...baseDeps, jobRunsDao: jobRuns.dao, rollupsDao: rollups.dao })
    ).rejects.toThrow("Athena query CANCELLED: unknown");
  });

  it("tolerates a missing QueryExecutionId, absent Statistics and an empty ResultSet", async () => {
    const jobRuns = fakeJobRunsDao(null);
    const rollups = fakeRollupsDao();
    athenaMock.on(StartQueryExecutionCommand).resolves({});
    athenaMock.on(GetQueryExecutionCommand).resolves({ QueryExecution: { Status: { State: "SUCCEEDED" } } });
    athenaMock.on(GetQueryResultsCommand).resolves({});

    const result = await runSampleWarehouseJob({ ...baseDeps, jobRunsDao: jobRuns.dao, rollupsDao: rollups.dao });

    expect(result.status).toBe("SUCCEEDED");
    expect(result).toMatchObject({
      execution_ref: "",
      data_scanned_bytes: null,
      engine_execution_time_ms: null,
      query_queue_time_ms: null,
    });
    expect(rollups.puts).toHaveLength(0);
  });

  it("polls while the query is RUNNING, then completes on SUCCEEDED", async () => {
    const jobRuns = fakeJobRunsDao(null);
    const rollups = fakeRollupsDao();
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
        Rows: [{ Data: [{ VarCharValue: "dimension" }, { VarCharValue: "value" }] }, { Data: [{}, {}] }, {}],
      },
    });

    const result = await runSampleWarehouseJob({
      ...baseDeps,
      sleep,
      jobRunsDao: jobRuns.dao,
      rollupsDao: rollups.dao,
    });

    expect(result.status).toBe("SUCCEEDED");
    expect(sleep).toHaveBeenCalledWith(2_000);
    expect(athenaMock.commandCalls(GetQueryExecutionCommand).length).toBeGreaterThanOrEqual(2);
    expect(rollups.puts[0]).toMatchObject({ rollup_key: "2026-09-06#", dimension: "", value: 0 });
  });

  it("stringifies a non-Error failure into error_message before rethrowing", async () => {
    const jobRuns = fakeJobRunsDao(null);
    const rollups = fakeRollupsDao();
    rollups.dao.putRollup = vi.fn().mockRejectedValue("raw string blow-up");
    mockAthenaSuccess([["INGEST", "1"]]);

    await expect(
      runSampleWarehouseJob({ ...baseDeps, jobRunsDao: jobRuns.dao, rollupsDao: rollups.dao })
    ).rejects.toBe("raw string blow-up");

    expect(jobRuns.puts[jobRuns.puts.length - 1]).toMatchObject({
      status: "FAILED",
      error_message: "raw string blow-up",
    });
  });

  it("times out and writes the run FAILED if the query never leaves RUNNING", async () => {
    const jobRuns = fakeJobRunsDao(null);
    const rollups = fakeRollupsDao();
    athenaMock.on(StartQueryExecutionCommand).resolves({ QueryExecutionId: "q-hang" });
    athenaMock.on(GetQueryExecutionCommand).resolves({ QueryExecution: { Status: { State: "RUNNING" } } });

    await expect(
      runSampleWarehouseJob({ ...baseDeps, jobRunsDao: jobRuns.dao, rollupsDao: rollups.dao })
    ).rejects.toThrow("timed out");

    expect(jobRuns.puts[jobRuns.puts.length - 1]).toMatchObject({ status: "FAILED" });
  });

  it("resolves every dependency (clients, clock, sleep) from defaults when deps is empty", async () => {
    const restore = withRunnerEnv();
    try {
      ddbMock.on(QueryCommand).resolves({ Items: [] });
      ddbMock.on(PutCommand).resolves({});
      mockAthenaSuccess([["INGEST", "7"]]);

      const result = await runSampleWarehouseJob();

      expect(result.status).toBe("SUCCEEDED");
      expect(result.trigger).toBe("SCHEDULED");
      expect(ddbMock.commandCalls(PutCommand).length).toBeGreaterThanOrEqual(3);
    } finally {
      restore();
    }
  });

  it("throws a clear error when a required env var is missing and nothing is injected", async () => {
    const restore = withRunnerEnv({ WAREHOUSE_DATABASE_NAME: undefined });
    try {
      await expect(runSampleWarehouseJob({ athenaClient, now: NOW })).rejects.toThrow(
        "Missing required environment variable: WAREHOUSE_DATABASE_NAME"
      );
    } finally {
      restore();
    }
  });
});
