import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { logError, logInfo } from "../../logger";
import { WarehouseJobRunsDao } from "../../dao/analytics/warehouseJobRunsDao";
import { JobResultSchema, type JobResult } from "../../models/jobResult";
import type { JobRunResultItem } from "../../models/jobRunResults";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

export interface GetJobResultDeps {
  jobRunsDao?: WarehouseJobRunsDao;
  s3Client?: S3Client;
}

/** `s3://bucket/key` → `{ bucket, key }`. */
function parseS3Uri(uri: string): { bucket: string; key: string } {
  const match = /^s3:\/\/([^/]+)\/(.+)$/.exec(uri);
  if (!match) throw new Error(`Not an s3:// URI: ${uri}`);
  return { bucket: match[1], key: match[2] };
}

/** Parses, fetches, and validates one `result.json` — shared by {@link getJobResult} and {@link getJobRunResults}. */
async function fetchResultEnvelope(resultLocation: string, s3Client: S3Client): Promise<JobResult> {
  const { bucket, key } = parseS3Uri(resultLocation);
  const response = await s3Client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  const body = await response.Body?.transformToString();
  if (!body) throw new Error(`Empty result object at ${resultLocation}`);
  return JobResultSchema.parse(JSON.parse(body));
}

/**
 * Backs `GET /data/jobs/{name}/result` (`7-data-warehousing.md` §11) —
 * resolves the latest `SUCCEEDED` run's `result_location` from
 * `WarehouseJobRuns`, `s3:GetObject`s that `result.json`, and returns the
 * envelope validated. `null` if the job has never produced a resultset
 * (the controller maps that to a 404).
 */
export async function getJobResult(jobName: string, deps: GetJobResultDeps = {}): Promise<JobResult | null> {
  const jobRunsDao =
    deps.jobRunsDao ??
    new WarehouseJobRunsDao(
      DynamoDBDocumentClient.from(new DynamoDBClient({})),
      requireEnv("WAREHOUSE_JOB_RUNS_TABLE_NAME")
    );
  const s3Client = deps.s3Client ?? new S3Client({});

  logInfo("GetJobResultStarted", { jobName });

  const latest = await jobRunsDao.getLatestSucceededRunForJob(jobName);
  if (!latest?.result_location) {
    logInfo("GetJobResultNoResult", { jobName, hasRun: latest !== null });
    return null;
  }

  const result = await fetchResultEnvelope(latest.result_location, s3Client);
  logInfo("GetJobResultCompleted", { jobName, runDate: result.run_date, rowCount: result.rows.length });
  return result;
}

/**
 * Backs admin-authorized `POST /admin/warehouse/job-runs/results` —
 * resolves each requested run by its own primary key (unlike
 * {@link getJobResult}'s "latest SUCCEEDED for a job name"). Each id is
 * resolved independently — a run with no result yet (still RUNNING,
 * FAILED, or never existed) or a failed S3 fetch becomes a per-item
 * `error`, never a failure of the whole batch, since this backs a
 * multi-report dashboard where one missing report shouldn't blank out
 * the others.
 */
export async function getJobRunResults(jobRunIds: string[], deps: GetJobResultDeps = {}): Promise<JobRunResultItem[]> {
  const jobRunsDao =
    deps.jobRunsDao ??
    new WarehouseJobRunsDao(
      DynamoDBDocumentClient.from(new DynamoDBClient({})),
      requireEnv("WAREHOUSE_JOB_RUNS_TABLE_NAME")
    );
  const s3Client = deps.s3Client ?? new S3Client({});

  logInfo("GetJobRunResultsStarted", { jobRunIds });

  const results = await Promise.all(
    jobRunIds.map(async (jobRunId): Promise<JobRunResultItem> => {
      try {
        const run = await jobRunsDao.getJobRun(jobRunId);
        if (!run?.result_location) {
          logInfo("GetJobRunResultsNoResult", { jobRunId, hasRun: run !== null });
          return { job_run_id: jobRunId, result: null, error: "No result for this job run" };
        }
        const result = await fetchResultEnvelope(run.result_location, s3Client);
        return { job_run_id: jobRunId, result, error: null };
      } catch (err) {
        logError("GetJobRunResultsItemFailed", { jobRunId, error: err instanceof Error ? err.message : err });
        return { job_run_id: jobRunId, result: null, error: err instanceof Error ? err.message : "Failed to load result" };
      }
    })
  );

  logInfo("GetJobRunResultsCompleted", { count: results.length, succeeded: results.filter((r) => r.result !== null).length });
  return results;
}
