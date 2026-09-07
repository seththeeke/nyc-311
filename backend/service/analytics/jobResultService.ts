import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { logInfo } from "../../logger";
import { WarehouseJobRunsDao } from "../../dao/analytics/warehouseJobRunsDao";
import { JobResultSchema, type JobResult } from "../../models/jobResult";

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

  const { bucket, key } = parseS3Uri(latest.result_location);
  const response = await s3Client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  const body = await response.Body?.transformToString();
  if (!body) throw new Error(`Empty result object at ${latest.result_location}`);

  const result = JobResultSchema.parse(JSON.parse(body));
  logInfo("GetJobResultCompleted", { jobName, runDate: result.run_date, rowCount: result.rows.length });
  return result;
}
