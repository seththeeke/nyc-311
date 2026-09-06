import { setTimeout as delayMs } from "node:timers/promises";
import { ulid } from "ulid";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import {
  AthenaClient,
  StartQueryExecutionCommand,
  GetQueryExecutionCommand,
  GetQueryResultsCommand,
} from "@aws-sdk/client-athena";
import { logError, logInfo } from "../../logger";
import { WarehouseJobRunsDao } from "../../dao/analytics/warehouseJobRunsDao";
import { AnalyticsRollupsDao } from "../../dao/analytics/analyticsRollupsDao";
import { MAX_JOB_RETRIES, type WarehouseJobRun, type WarehouseJobRunTrigger } from "../../models/warehouseJobRun";
import type { AnalyticsRollup } from "../../models/analyticsRollup";
import { SAMPLE_METRIC_VIEW } from "./analyticsRollupsService";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

const JOB_NAME = SAMPLE_METRIC_VIEW;
const QUERY_POLL_INTERVAL_MS = 2_000;
const QUERY_MAX_WAIT_MS = 120_000;

export interface WarehouseJobRunnerDeps {
  jobRunsDao?: WarehouseJobRunsDao;
  rollupsDao?: AnalyticsRollupsDao;
  athenaClient?: AthenaClient;
  sql?: string;
  database?: string;
  workgroup?: string;
  now?: () => Date;
  sleep?: (ms: number) => Promise<void>;
}

interface ResolvedDeps {
  jobRunsDao: WarehouseJobRunsDao;
  rollupsDao: AnalyticsRollupsDao;
  athenaClient: AthenaClient;
  sql: string;
  database: string;
  workgroup: string;
  now: () => Date;
  sleep: (ms: number) => Promise<void>;
}

function resolve(deps: WarehouseJobRunnerDeps): ResolvedDeps {
  const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
  return {
    jobRunsDao: deps.jobRunsDao ?? new WarehouseJobRunsDao(ddb, requireEnv("WAREHOUSE_JOB_RUNS_TABLE_NAME")),
    rollupsDao: deps.rollupsDao ?? new AnalyticsRollupsDao(ddb, requireEnv("ANALYTICS_ROLLUPS_TABLE_NAME")),
    athenaClient: deps.athenaClient ?? new AthenaClient({}),
    sql: deps.sql ?? requireEnv("SAMPLE_JOB_SQL"),
    database: deps.database ?? requireEnv("WAREHOUSE_DATABASE_NAME"),
    workgroup: deps.workgroup ?? requireEnv("ATHENA_WORKGROUP"),
    now: deps.now ?? (() => new Date()),
    sleep: deps.sleep ?? delayMs,
  };
}

/**
 * Decides whether this invocation is a fresh scheduled run or a retry of
 * the last one (`7-data-warehousing.md` §9's retry sweep, collapsed to a
 * single-job decision): a retry only if the most recent run for this job
 * FAILED and hasn't hit `MAX_JOB_RETRIES`.
 */
function retryDecision(latest: WarehouseJobRun | null): {
  trigger: WarehouseJobRunTrigger;
  retryCount: number;
  retriedFrom: string | null;
} {
  if (latest && latest.status === "FAILED" && latest.retry_count < MAX_JOB_RETRIES) {
    return { trigger: "RETRY", retryCount: latest.retry_count + 1, retriedFrom: latest.job_run_id };
  }
  return { trigger: "SCHEDULED", retryCount: 0, retriedFrom: null };
}

async function runAthenaQuery(
  d: ResolvedDeps
): Promise<{ queryExecutionId: string; rows: string[][]; stats: Pick<WarehouseJobRun, "data_scanned_bytes" | "engine_execution_time_ms" | "query_queue_time_ms"> }> {
  const start = await d.athenaClient.send(
    new StartQueryExecutionCommand({
      QueryString: d.sql,
      WorkGroup: d.workgroup,
      QueryExecutionContext: { Database: d.database },
    })
  );
  const queryExecutionId = start.QueryExecutionId ?? "";
  logInfo("WarehouseJobAthenaStarted", { queryExecutionId });

  let waited = 0;
  for (;;) {
    const exec = await d.athenaClient.send(new GetQueryExecutionCommand({ QueryExecutionId: queryExecutionId }));
    const state = exec.QueryExecution?.Status?.State;
    if (state === "SUCCEEDED") {
      const s = exec.QueryExecution?.Statistics;
      const results = await d.athenaClient.send(new GetQueryResultsCommand({ QueryExecutionId: queryExecutionId }));
      const rows = (results.ResultSet?.Rows ?? [])
        .slice(1)
        .map((r) => (r.Data ?? []).map((c) => c.VarCharValue ?? ""));
      return {
        queryExecutionId,
        rows,
        stats: {
          data_scanned_bytes: s?.DataScannedInBytes ?? null,
          engine_execution_time_ms: s?.EngineExecutionTimeInMillis ?? null,
          query_queue_time_ms: s?.QueryQueueTimeInMillis ?? null,
        },
      };
    }
    if (state === "FAILED" || state === "CANCELLED") {
      const reason = exec.QueryExecution?.Status?.StateChangeReason ?? "unknown";
      throw new Error(`Athena query ${state}: ${reason}`);
    }
    if (waited >= QUERY_MAX_WAIT_MS) throw new Error(`Athena query timed out after ${QUERY_MAX_WAIT_MS}ms`);
    await d.sleep(QUERY_POLL_INTERVAL_MS);
    waited += QUERY_POLL_INTERVAL_MS;
  }
}

/**
 * One scheduled run of the sample job (`7-data-warehousing.md` §8/§9),
 * simplified from a Step Functions state machine to a single Lambda —
 * the query scans kilobytes and returns in seconds, so orchestration
 * isn't warranted (Leg 4's rebuild, which genuinely needs SFN, is
 * separate). Records a `RUNNING` `WarehouseJobRun`, runs the Athena
 * query, folds the `(dimension, value)` rows into `AnalyticsRollups`, and
 * closes the run `SUCCEEDED`/`FAILED` with the query's own stats.
 */
export async function runSampleWarehouseJob(deps: WarehouseJobRunnerDeps = {}): Promise<WarehouseJobRun> {
  const d = resolve(deps);
  const startedAt = d.now().toISOString();
  const runDate = startedAt.slice(0, 10);

  const latest = await d.jobRunsDao.getLatestRunForJob(JOB_NAME);
  const decision = retryDecision(latest);
  logInfo("WarehouseJobRunStarted", { jobName: JOB_NAME, ...decision });

  let run: WarehouseJobRun = {
    job_run_id: ulid(),
    job_name: JOB_NAME,
    status: "RUNNING",
    trigger: decision.trigger,
    started_at: startedAt,
    completed_at: null,
    execution_ref: null,
    error_message: null,
    retry_count: decision.retryCount,
    retried_from_job_run_id: decision.retriedFrom,
    data_scanned_bytes: null,
    engine_execution_time_ms: null,
    query_queue_time_ms: null,
  };
  await d.jobRunsDao.putJobRun(run);

  try {
    const { queryExecutionId, rows, stats } = await runAthenaQuery(d);

    const computedAt = d.now().toISOString();
    for (const [dimension, value] of rows) {
      const rollup: AnalyticsRollup = {
        metric_view: JOB_NAME,
        rollup_key: `${runDate}#${dimension}`,
        run_date: runDate,
        dimension,
        value: Number(value),
        computed_at: computedAt,
        job_run_id: run.job_run_id,
      };
      await d.rollupsDao.putRollup(rollup);
    }
    logInfo("WarehouseJobRollupsWritten", { jobRunId: run.job_run_id, rowCount: rows.length });

    run = {
      ...run,
      status: "SUCCEEDED",
      completed_at: d.now().toISOString(),
      execution_ref: queryExecutionId,
      ...stats,
    };
    await d.jobRunsDao.putJobRun(run);
    logInfo("WarehouseJobRunSucceeded", { jobRunId: run.job_run_id, ...stats });
    return run;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logError("WarehouseJobRunFailed", { jobRunId: run.job_run_id, error: message });
    run = { ...run, status: "FAILED", completed_at: d.now().toISOString(), error_message: message };
    await d.jobRunsDao.putJobRun(run);
    throw err;
  }
}
