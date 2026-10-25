import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { logError, logInfo } from "../../logger";
import { requireEnv } from "../../env";
import { createDocumentClient } from "../../dynamoClient";
import { WarehouseJobRunsDao } from "../../dao/analytics/warehouseJobRunsDao";
import { JobResultSchema, type JobResult } from "../../models/jobResult";
import type { JobRunResultItem } from "../../models/jobRunResults";

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

/** Parses, fetches, and validates one `result.json` for {@link getJobRunResults}. */
async function fetchResultEnvelope(resultLocation: string, s3Client: S3Client): Promise<JobResult> {
  const { bucket, key } = parseS3Uri(resultLocation);
  const response = await s3Client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  const body = await response.Body?.transformToString();
  if (!body) throw new Error(`Empty result object at ${resultLocation}`);
  return JobResultSchema.parse(JSON.parse(body));
}

/**
 * Backs admin-authorized `POST /admin/warehouse/job-runs/results` —
 * resolves each requested run by its own primary key. Each id is
 * resolved independently — a run with no result yet (still RUNNING,
 * FAILED, or never existed) or a failed S3 fetch becomes a per-item
 * `error`, never a failure of the whole batch, since this backs a
 * multi-report dashboard where one missing report shouldn't blank out
 * the others.
 */
export async function getJobRunResults(jobRunIds: string[], deps: GetJobResultDeps = {}): Promise<JobRunResultItem[]> {
  const jobRunsDao =
    deps.jobRunsDao ??
    new WarehouseJobRunsDao(createDocumentClient(), requireEnv("WAREHOUSE_JOB_RUNS_TABLE_NAME"));
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
