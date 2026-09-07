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
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { logError, logInfo } from "../../logger";
import { WarehouseJobRunsDao } from "../../dao/analytics/warehouseJobRunsDao";
import { MAX_JOB_RETRIES, type WarehouseJobRun, type WarehouseJobRunTrigger } from "../../models/warehouseJobRun";
import type { JobResult, JobResultColumn } from "../../models/jobResult";
import { WarehouseJobManifestSchema, type WarehouseJob } from "../../models/warehouseJob";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

const QUERY_POLL_INTERVAL_MS = 2_000;
const QUERY_MAX_WAIT_MS = 120_000;

export interface WarehouseJobRunnerDeps {
  jobRunsDao?: WarehouseJobRunsDao;
  athenaClient?: AthenaClient;
  s3Client?: S3Client;
  jobs?: WarehouseJob[];
  resultsBucket?: string;
  database?: string;
  workgroup?: string;
  now?: () => Date;
  sleep?: (ms: number) => Promise<void>;
}

interface ResolvedDeps {
  jobRunsDao: WarehouseJobRunsDao;
  athenaClient: AthenaClient;
  s3Client: S3Client;
  jobs: WarehouseJob[];
  resultsBucket: string;
  database: string;
  workgroup: string;
  now: () => Date;
  sleep: (ms: number) => Promise<void>;
}

function resolve(deps: WarehouseJobRunnerDeps): ResolvedDeps {
  const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
  return {
    jobRunsDao: deps.jobRunsDao ?? new WarehouseJobRunsDao(ddb, requireEnv("WAREHOUSE_JOB_RUNS_TABLE_NAME")),
    athenaClient: deps.athenaClient ?? new AthenaClient({}),
    s3Client: deps.s3Client ?? new S3Client({}),
    jobs: deps.jobs ?? WarehouseJobManifestSchema.parse(JSON.parse(requireEnv("WAREHOUSE_JOBS"))),
    resultsBucket: deps.resultsBucket ?? requireEnv("JOB_RESULTS_BUCKET"),
    database: deps.database ?? requireEnv("WAREHOUSE_DATABASE_NAME"),
    workgroup: deps.workgroup ?? requireEnv("ATHENA_WORKGROUP"),
    now: deps.now ?? (() => new Date()),
    sleep: deps.sleep ?? delayMs,
  };
}

/**
 * Whether this run of a given job is a fresh scheduled run or a retry of
 * its last one (`7-data-warehousing.md` §9): a retry only if that job's
 * most recent run FAILED and hasn't hit `MAX_JOB_RETRIES`.
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

interface AthenaResult {
  queryExecutionId: string;
  columns: JobResultColumn[];
  rows: string[][];
  stats: Pick<WarehouseJobRun, "data_scanned_bytes" | "engine_execution_time_ms" | "query_queue_time_ms">;
}

async function runAthenaQuery(d: ResolvedDeps, sql: string): Promise<AthenaResult> {
  const start = await d.athenaClient.send(
    new StartQueryExecutionCommand({
      QueryString: sql,
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
      /* Result sets here are aggregations (tens of rows) — no NextToken paging needed. */
      const results = await d.athenaClient.send(new GetQueryResultsCommand({ QueryExecutionId: queryExecutionId }));
      const columns = (results.ResultSet?.ResultSetMetadata?.ColumnInfo ?? []).map((c) => ({
        name: c.Name ?? "",
        type: c.Type ?? "",
      }));
      const rows = (results.ResultSet?.Rows ?? [])
        .slice(1)
        .map((r) => (r.Data ?? []).map((c) => c.VarCharValue ?? ""));
      return {
        queryExecutionId,
        columns,
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

/** `job-results/job_name=<job>/run_date=<date>/result.json` — the S3 key for one run's resultset (§11). */
function resultKey(jobName: string, runDate: string): string {
  return `job-results/job_name=${jobName}/run_date=${runDate}/result.json`;
}

function buildEnvelope(
  job: WarehouseJob,
  jobRunId: string,
  runDate: string,
  computedAt: string,
  athena: AthenaResult
): JobResult {
  const names = athena.columns.map((c) => c.name);
  return {
    job_name: job.name,
    job_run_id: jobRunId,
    run_date: runDate,
    computed_at: computedAt,
    columns: athena.columns,
    rows: athena.rows.map((row) => Object.fromEntries(names.map((name, i) => [name, row[i] ?? ""]))),
  };
}

async function runOneJob(d: ResolvedDeps, job: WarehouseJob): Promise<WarehouseJobRun> {
  const startedAt = d.now().toISOString();
  const runDate = startedAt.slice(0, 10);

  const latest = await d.jobRunsDao.getLatestRunForJob(job.name);
  const decision = retryDecision(latest);
  logInfo("WarehouseJobStarted", { jobName: job.name, ...decision });

  let run: WarehouseJobRun = {
    job_run_id: ulid(),
    job_name: job.name,
    status: "RUNNING",
    trigger: decision.trigger,
    started_at: startedAt,
    completed_at: null,
    execution_ref: null,
    result_location: null,
    row_count: null,
    error_message: null,
    retry_count: decision.retryCount,
    retried_from_job_run_id: decision.retriedFrom,
    data_scanned_bytes: null,
    engine_execution_time_ms: null,
    query_queue_time_ms: null,
  };
  await d.jobRunsDao.putJobRun(run);

  try {
    const athena = await runAthenaQuery(d, job.sql);
    const computedAt = d.now().toISOString();

    const key = resultKey(job.name, runDate);
    const envelope = buildEnvelope(job, run.job_run_id, runDate, computedAt, athena);
    await d.s3Client.send(
      new PutObjectCommand({
        Bucket: d.resultsBucket,
        Key: key,
        Body: JSON.stringify(envelope),
        ContentType: "application/json",
      })
    );
    const resultLocation = `s3://${d.resultsBucket}/${key}`;
    logInfo("WarehouseJobResultWritten", {
      jobRunId: run.job_run_id,
      jobName: job.name,
      resultLocation,
      rowCount: athena.rows.length,
    });

    run = {
      ...run,
      status: "SUCCEEDED",
      completed_at: d.now().toISOString(),
      execution_ref: athena.queryExecutionId,
      result_location: resultLocation,
      row_count: athena.rows.length,
      ...athena.stats,
    };
    await d.jobRunsDao.putJobRun(run);
    logInfo("WarehouseJobSucceeded", { jobRunId: run.job_run_id, jobName: job.name, ...athena.stats });
    return run;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logError("WarehouseJobFailed", { jobRunId: run.job_run_id, jobName: job.name, error: message });
    run = { ...run, status: "FAILED", completed_at: d.now().toISOString(), error_message: message };
    await d.jobRunsDao.putJobRun(run);
    return run;
  }
}

/**
 * One invocation of the daily runner (`7-data-warehousing.md` §8) — runs
 * every registered job in turn, each in its own try/catch so one job's
 * failure never blocks the rest. Per job: run the Athena query, write the
 * resultset envelope to S3 (§11), record the run in `WarehouseJobRuns`. A
 * failed job shows on `/data`, is auto-retried next day (§9), and does
 * not fail the runner Lambda — the schedule's error alarm is for a
 * runner-level crash, not one job's SQL bug.
 */
export async function runWarehouseJobs(deps: WarehouseJobRunnerDeps = {}): Promise<WarehouseJobRun[]> {
  const d = resolve(deps);
  logInfo("WarehouseJobRunnerStarted", { jobCount: d.jobs.length, jobs: d.jobs.map((j) => j.name) });

  const runs: WarehouseJobRun[] = [];
  for (const job of d.jobs) {
    runs.push(await runOneJob(d, job));
  }

  const failed = runs.filter((r) => r.status === "FAILED").map((r) => r.job_name);
  logInfo("WarehouseJobRunnerCompleted", { total: runs.length, failed });
  return runs;
}
