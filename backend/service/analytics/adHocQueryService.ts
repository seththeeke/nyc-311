import { setTimeout as delayMs } from "node:timers/promises";
import {
  AthenaClient,
  StartQueryExecutionCommand,
  GetQueryExecutionCommand,
  GetQueryResultsCommand,
} from "@aws-sdk/client-athena";
import { logInfo } from "../../logger";
import { ValidationError } from "../../models/errors";
import type { AdHocQueryResult } from "../../models/adHocQueryResult";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

/*
 * The controller's fast, honest reject for an obvious mistake — not the
 * real enforcement boundary. IAM (this Lambda's scoped role, §15) is what
 * actually prevents a mutation; this just gives a clear 400 for the
 * common case of someone pasting a write statement.
 */
const READ_ONLY_LEADING_KEYWORDS = ["SELECT", "WITH", "SHOW", "DESCRIBE", "EXPLAIN"];

/** True if `sql`'s first keyword is one of the read-only statement types this console allows. */
export function isReadOnlyStatement(sql: string): boolean {
  const firstKeyword = sql.trim().split(/\s+/)[0]?.toUpperCase() ?? "";
  return READ_ONLY_LEADING_KEYWORDS.includes(firstKeyword);
}

/*
 * Synchronous over API Gateway HTTP API's fixed 29s integration ceiling
 * (7-data-warehousing.md §12a) — 20s query budget, polled faster than the
 * daily job runner's 2s interval since this is a human waiting on a
 * result, not an unattended nightly run.
 */
const QUERY_POLL_INTERVAL_MS = 500;
const QUERY_MAX_WAIT_MS = 20_000;
/** GetQueryResults' row cap for this console — a human reading a table, not exporting a dataset. */
const MAX_ROWS = 500;

export interface AdHocQueryDeps {
  athenaClient?: AthenaClient;
  workgroup?: string;
  database?: string;
  sleep?: (ms: number) => Promise<void>;
}

interface ResolvedDeps {
  athenaClient: AthenaClient;
  workgroup: string;
  database: string;
  sleep: (ms: number) => Promise<void>;
}

function resolve(deps: AdHocQueryDeps): ResolvedDeps {
  return {
    athenaClient: deps.athenaClient ?? new AthenaClient({}),
    workgroup: deps.workgroup ?? requireEnv("AD_HOC_ATHENA_WORKGROUP"),
    database: deps.database ?? requireEnv("WAREHOUSE_DATABASE_NAME"),
    sleep: deps.sleep ?? delayMs,
  };
}

/**
 * Runs one admin-supplied ad-hoc SQL query against the warehouse
 * (`7-data-warehousing.md` §12a, Leg 7): rejects anything that isn't
 * `SELECT`/`WITH`/`SHOW`/`DESCRIBE`/`EXPLAIN`, then `StartQueryExecution`
 * → poll `GetQueryExecution` → `GetQueryResults` on the dedicated
 * `Nyc311AdHocQueries` workgroup — the same shape as
 * `warehouseJobRunnerService.ts`'s poll loop, at a shorter timeout since a
 * human is waiting synchronously. Rows capped at 500; `truncated` reflects
 * whether Athena had more.
 */
export async function runAdHocQuery(sql: string, deps: AdHocQueryDeps = {}): Promise<AdHocQueryResult> {
  if (!isReadOnlyStatement(sql)) {
    throw new ValidationError("Only SELECT/WITH/SHOW/DESCRIBE/EXPLAIN statements are allowed");
  }

  const d = resolve(deps);
  const start = await d.athenaClient.send(
    new StartQueryExecutionCommand({
      QueryString: sql,
      WorkGroup: d.workgroup,
      QueryExecutionContext: { Database: d.database },
    })
  );
  const queryExecutionId = start.QueryExecutionId ?? "";
  logInfo("AdHocQueryStarted", { queryExecutionId });

  let waited = 0;
  for (;;) {
    const exec = await d.athenaClient.send(new GetQueryExecutionCommand({ QueryExecutionId: queryExecutionId }));
    const state = exec.QueryExecution?.Status?.State;

    if (state === "SUCCEEDED") {
      const s = exec.QueryExecution?.Statistics;
      const results = await d.athenaClient.send(
        new GetQueryResultsCommand({ QueryExecutionId: queryExecutionId, MaxResults: MAX_ROWS + 1 })
      );
      const columns = (results.ResultSet?.ResultSetMetadata?.ColumnInfo ?? []).map((c) => ({
        name: c.Name ?? "",
        type: c.Type ?? "",
      }));
      const names = columns.map((c) => c.name);
      const dataRows = (results.ResultSet?.Rows ?? []).slice(1);
      const rows = dataRows.map((r) => {
        const values = (r.Data ?? []).map((c) => c.VarCharValue ?? "");
        return Object.fromEntries(names.map((name, i) => [name, values[i] ?? ""]));
      });

      const result: AdHocQueryResult = {
        columns,
        rows,
        row_count: rows.length,
        truncated: Boolean(results.NextToken),
        data_scanned_bytes: s?.DataScannedInBytes ?? null,
        engine_execution_time_ms: s?.EngineExecutionTimeInMillis ?? null,
      };
      logInfo("AdHocQuerySucceeded", { queryExecutionId, rowCount: result.row_count, truncated: result.truncated });
      return result;
    }

    if (state === "FAILED" || state === "CANCELLED") {
      const reason = exec.QueryExecution?.Status?.StateChangeReason ?? "unknown";
      throw new Error(`Athena query ${state}: ${reason}`);
    }

    if (waited >= QUERY_MAX_WAIT_MS) {
      throw new Error(`Ad-hoc query timed out after ${QUERY_MAX_WAIT_MS}ms — narrow the query and try again`);
    }
    await d.sleep(QUERY_POLL_INTERVAL_MS);
    waited += QUERY_POLL_INTERVAL_MS;
  }
}
