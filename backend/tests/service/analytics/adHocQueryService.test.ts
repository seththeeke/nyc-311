import {
  AthenaClient,
  StartQueryExecutionCommand,
  GetQueryExecutionCommand,
  GetQueryResultsCommand,
} from "@aws-sdk/client-athena";
import { mockClient } from "aws-sdk-client-mock";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isReadOnlyStatement, runAdHocQuery } from "../../../service/analytics/adHocQueryService";
import { ValidationError } from "../../../models/errors";

const athenaMock = mockClient(AthenaClient);
const athenaClient = new AthenaClient({});

const DEPS = {
  athenaClient,
  workgroup: "Nyc311AdHocQueries-Test",
  database: "nyc311_warehouse_test",
  sleep: async () => {},
};

beforeEach(() => {
  athenaMock.reset();
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("isReadOnlyStatement", () => {
  it.each(["SELECT 1", "  select * from x", "WITH a AS (SELECT 1) SELECT * FROM a", "SHOW TABLES", "DESCRIBE x", "EXPLAIN SELECT 1"])(
    "accepts %s",
    (sql) => {
      expect(isReadOnlyStatement(sql)).toBe(true);
    }
  );

  it.each(["DELETE FROM order_events", "INSERT INTO x VALUES (1)", "DROP TABLE x", "ALTER TABLE x ADD COLUMN y int", "", "   "])(
    "rejects %s",
    (sql) => {
      expect(isReadOnlyStatement(sql)).toBe(false);
    }
  );
});

describe("runAdHocQuery", () => {
  it("throws a ValidationError for a non-read-only statement without ever calling Athena", async () => {
    await expect(runAdHocQuery("DELETE FROM order_events", DEPS)).rejects.toBeInstanceOf(ValidationError);
    expect(athenaMock.calls()).toHaveLength(0);
  });

  it("runs the query and returns columns/rows/stats on success", async () => {
    athenaMock.on(StartQueryExecutionCommand).resolves({ QueryExecutionId: "q-1" });
    athenaMock.on(GetQueryExecutionCommand).resolves({
      QueryExecution: {
        Status: { State: "SUCCEEDED" },
        Statistics: { DataScannedInBytes: 1024, EngineExecutionTimeInMillis: 250 },
      },
    });
    athenaMock.on(GetQueryResultsCommand).resolves({
      ResultSet: {
        ResultSetMetadata: { ColumnInfo: [{ Name: "borough", Type: "varchar" }] },
        Rows: [{ Data: [{ VarCharValue: "borough" }] }, { Data: [{ VarCharValue: "BROOKLYN" }] }],
      },
    });

    const result = await runAdHocQuery("SELECT borough FROM locations", DEPS);

    expect(result).toEqual({
      columns: [{ name: "borough", type: "varchar" }],
      rows: [{ borough: "BROOKLYN" }],
      row_count: 1,
      truncated: false,
      data_scanned_bytes: 1024,
      engine_execution_time_ms: 250,
    });
    const startCall = athenaMock.commandCalls(StartQueryExecutionCommand)[0]?.args[0].input;
    expect(startCall?.WorkGroup).toBe("Nyc311AdHocQueries-Test");
    expect(startCall?.QueryExecutionContext?.Database).toBe("nyc311_warehouse_test");
  });

  it("sets truncated true when Athena reports a NextToken (more rows than the 500 cap)", async () => {
    athenaMock.on(StartQueryExecutionCommand).resolves({ QueryExecutionId: "q-2" });
    athenaMock.on(GetQueryExecutionCommand).resolves({ QueryExecution: { Status: { State: "SUCCEEDED" } } });
    athenaMock.on(GetQueryResultsCommand).resolves({
      NextToken: "more",
      ResultSet: {
        ResultSetMetadata: { ColumnInfo: [{ Name: "n", Type: "bigint" }] },
        Rows: [{ Data: [{ VarCharValue: "n" }] }, { Data: [{ VarCharValue: "1" }] }],
      },
    });

    const result = await runAdHocQuery("SELECT 1", DEPS);

    expect(result.truncated).toBe(true);
  });

  it("defaults a missing column Name/Type, missing Data, and a missing/short VarCharValue to empty strings", async () => {
    athenaMock.on(StartQueryExecutionCommand).resolves({ QueryExecutionId: "q-defaults" });
    athenaMock.on(GetQueryExecutionCommand).resolves({ QueryExecution: { Status: { State: "SUCCEEDED" } } });
    athenaMock.on(GetQueryResultsCommand).resolves({
      ResultSet: {
        ResultSetMetadata: { ColumnInfo: [{ Name: undefined, Type: undefined }, { Name: "b", Type: undefined }] },
        Rows: [
          /* header row, dropped by .slice(1) */ { Data: [{ VarCharValue: "" }, { VarCharValue: "b" }] },
          /* Data entirely missing */ {},
          /* Data present, VarCharValue missing on both */ { Data: [{}, {}] },
          /* short Data array — second column falls back */ { Data: [{ VarCharValue: "only-first" }] },
        ],
      },
    });

    const result = await runAdHocQuery("SELECT 1", DEPS);

    expect(result.columns).toEqual([
      { name: "", type: "" },
      { name: "b", type: "" },
    ]);
    expect(result.rows).toEqual([
      { "": "", b: "" },
      { "": "", b: "" },
      { "": "only-first", b: "" },
    ]);
  });

  it("returns an empty resultset with null stats when the query has no rows/statistics", async () => {
    athenaMock.on(StartQueryExecutionCommand).resolves({});
    athenaMock.on(GetQueryExecutionCommand).resolves({ QueryExecution: { Status: { State: "SUCCEEDED" } } });
    athenaMock.on(GetQueryResultsCommand).resolves({});

    const result = await runAdHocQuery("SHOW TABLES", DEPS);

    expect(result).toEqual({
      columns: [],
      rows: [],
      row_count: 0,
      truncated: false,
      data_scanned_bytes: null,
      engine_execution_time_ms: null,
    });
  });

  it("throws with the StateChangeReason when the query FAILS", async () => {
    athenaMock.on(StartQueryExecutionCommand).resolves({ QueryExecutionId: "q-3" });
    athenaMock
      .on(GetQueryExecutionCommand)
      .resolves({ QueryExecution: { Status: { State: "FAILED", StateChangeReason: "SYNTAX_ERROR: bad column" } } });

    await expect(runAdHocQuery("SELECT nope FROM x", DEPS)).rejects.toThrow("SYNTAX_ERROR: bad column");
  });

  it("throws a generic message when a FAILED query has no StateChangeReason", async () => {
    athenaMock.on(StartQueryExecutionCommand).resolves({ QueryExecutionId: "q-3b" });
    athenaMock.on(GetQueryExecutionCommand).resolves({ QueryExecution: { Status: { State: "FAILED" } } });

    await expect(runAdHocQuery("SELECT 1", DEPS)).rejects.toThrow("Athena query FAILED: unknown");
  });

  it("throws on CANCELLED", async () => {
    athenaMock.on(StartQueryExecutionCommand).resolves({ QueryExecutionId: "q-4" });
    athenaMock.on(GetQueryExecutionCommand).resolves({ QueryExecution: { Status: { State: "CANCELLED" } } });

    await expect(runAdHocQuery("SELECT 1", DEPS)).rejects.toThrow("Athena query CANCELLED");
  });

  it("polls again while the query is still RUNNING before succeeding", async () => {
    const sleep = vi.fn().mockResolvedValue(undefined);
    athenaMock.on(StartQueryExecutionCommand).resolves({ QueryExecutionId: "q-poll" });
    athenaMock
      .on(GetQueryExecutionCommand)
      .resolvesOnce({ QueryExecution: { Status: { State: "RUNNING" } } })
      .resolves({ QueryExecution: { Status: { State: "SUCCEEDED" } } });
    athenaMock.on(GetQueryResultsCommand).resolves({});

    await runAdHocQuery("SELECT 1", { ...DEPS, sleep });

    expect(sleep).toHaveBeenCalledWith(500);
    expect(athenaMock.commandCalls(GetQueryExecutionCommand).length).toBeGreaterThanOrEqual(2);
  });

  it("times out if the query never leaves RUNNING", async () => {
    athenaMock.on(StartQueryExecutionCommand).resolves({ QueryExecutionId: "q-hang" });
    athenaMock.on(GetQueryExecutionCommand).resolves({ QueryExecution: { Status: { State: "RUNNING" } } });

    await expect(runAdHocQuery("SELECT 1", DEPS)).rejects.toThrow("timed out");
  });

  it("resolves athenaClient/workgroup/database/sleep from the environment when deps is empty", async () => {
    const previous = {
      AD_HOC_ATHENA_WORKGROUP: process.env["AD_HOC_ATHENA_WORKGROUP"],
      WAREHOUSE_DATABASE_NAME: process.env["WAREHOUSE_DATABASE_NAME"],
    };
    process.env["AD_HOC_ATHENA_WORKGROUP"] = "Nyc311AdHocQueries-Test";
    process.env["WAREHOUSE_DATABASE_NAME"] = "nyc311_warehouse_test";
    athenaMock.on(StartQueryExecutionCommand).resolves({ QueryExecutionId: "q-env" });
    athenaMock.on(GetQueryExecutionCommand).resolves({ QueryExecution: { Status: { State: "SUCCEEDED" } } });
    athenaMock.on(GetQueryResultsCommand).resolves({});

    try {
      const result = await runAdHocQuery("SELECT 1");
      expect(result.row_count).toBe(0);
    } finally {
      for (const [k, v] of Object.entries(previous)) {
        if (v === undefined) delete process.env[k];
        else process.env[k] = v;
      }
    }
  });

  it("throws when AD_HOC_ATHENA_WORKGROUP isn't provided and not set in the environment", async () => {
    const previous = process.env["AD_HOC_ATHENA_WORKGROUP"];
    delete process.env["AD_HOC_ATHENA_WORKGROUP"];

    try {
      await expect(runAdHocQuery("SELECT 1", { athenaClient, database: "db" })).rejects.toThrow(
        "Missing required environment variable: AD_HOC_ATHENA_WORKGROUP"
      );
    } finally {
      if (previous !== undefined) process.env["AD_HOC_ATHENA_WORKGROUP"] = previous;
    }
  });
});
