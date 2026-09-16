import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { S3Client, DeleteObjectCommand, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import {
  SchedulerClient,
  CreateScheduleCommand,
  DeleteScheduleCommand,
  UpdateScheduleCommand,
} from "@aws-sdk/client-scheduler";
import { logError, logInfo } from "../../logger";
import { WarehouseJobRunsDao } from "../../dao/analytics/warehouseJobRunsDao";
import { NotFoundError, TerminalError } from "../../models/errors";
import { warehouseJobDefinitionId, type WarehouseJobDefinition } from "../../models/warehouseJobDefinition";
import type { WarehouseJobType } from "../../models/warehouseJob";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

export interface WarehouseJobDefinitionDeps {
  jobRunsDao?: WarehouseJobRunsDao;
  s3Client?: S3Client;
  schedulerClient?: SchedulerClient;
  warehouseBucket?: string;
  scheduleGroupName?: string;
  scheduleRoleArn?: string;
  runnerFunctionArn?: string;
  deadLetterQueueArn?: string;
  envSuffix?: string;
  now?: () => Date;
}

interface ResolvedDeps {
  jobRunsDao: WarehouseJobRunsDao;
  s3Client: S3Client;
  schedulerClient: SchedulerClient;
  warehouseBucket: string;
  scheduleGroupName: string;
  scheduleRoleArn: string;
  runnerFunctionArn: string;
  deadLetterQueueArn: string;
  envSuffix: string;
  now: () => Date;
}

function resolve(deps: WarehouseJobDefinitionDeps): ResolvedDeps {
  const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
  return {
    jobRunsDao: deps.jobRunsDao ?? new WarehouseJobRunsDao(ddb, requireEnv("WAREHOUSE_JOB_RUNS_TABLE_NAME")),
    s3Client: deps.s3Client ?? new S3Client({}),
    schedulerClient: deps.schedulerClient ?? new SchedulerClient({}),
    warehouseBucket: deps.warehouseBucket ?? requireEnv("JOB_RESULTS_BUCKET"),
    scheduleGroupName: deps.scheduleGroupName ?? requireEnv("SCHEDULER_GROUP_NAME"),
    scheduleRoleArn: deps.scheduleRoleArn ?? requireEnv("SCHEDULER_ROLE_ARN"),
    runnerFunctionArn: deps.runnerFunctionArn ?? requireEnv("WAREHOUSE_JOB_RUNNER_FUNCTION_ARN"),
    deadLetterQueueArn: deps.deadLetterQueueArn ?? requireEnv("WAREHOUSE_JOB_DLQ_ARN"),
    envSuffix: deps.envSuffix ?? requireEnv("WAREHOUSE_JOB_ENV_SUFFIX"),
    now: deps.now ?? (() => new Date()),
  };
}

/** `job-definitions/<name>.sql` — the S3 key a job's SQL text lives at (`7-data-warehousing.md` §8). */
function sqlS3Key(name: string): string {
  return `job-definitions/${name}.sql`;
}

/** `Nyc311WarehouseJob-<name>-<Env>` — a job's EventBridge Scheduler schedule's physical name (§8). */
function scheduleName(name: string, envSuffix: string): string {
  return `Nyc311WarehouseJob-${name}-${envSuffix}`;
}

/**
 * Creates a self-service warehouse job or saved query
 * (`7-data-warehousing.md` §8/§12b, Leg 8): writes the SQL to S3, creates
 * the DDB definition row, then — `SCHEDULED` only — creates its
 * EventBridge Scheduler schedule. A `SAVED_QUERY` never gets one; it's
 * just SQL kept for later reload. An orphaned S3 object from a failed
 * later step is harmless, but a `SCHEDULED` definition with no schedule
 * isn't (see the thrown {@link TerminalError}).
 *
 * @throws {@link TerminalError} if the name already exists, or if a
 * `SCHEDULED` job's schedule fails to create after the definition was written.
 */
export async function createWarehouseJob(
  name: string,
  sql: string,
  createdBy: string,
  jobType: WarehouseJobType,
  cadenceCron?: string,
  deps: WarehouseJobDefinitionDeps = {}
): Promise<WarehouseJobDefinition> {
  const d = resolve(deps);
  const key = sqlS3Key(name);
  const schedName = jobType === "SCHEDULED" ? scheduleName(name, d.envSuffix) : undefined;
  logInfo("WarehouseJobDefinitionCreateStarted", { jobName: name, jobType, cadenceCron, scheduleName: schedName });

  await d.s3Client.send(
    new PutObjectCommand({ Bucket: d.warehouseBucket, Key: key, Body: sql, ContentType: "text/plain" })
  );

  const definition: WarehouseJobDefinition = {
    job_run_id: warehouseJobDefinitionId(name),
    record_type: "DEFINITION",
    job_name: name,
    sql_s3_key: key,
    job_type: jobType,
    /* Omitted (not set to undefined) for a SAVED_QUERY — DynamoDB's PutCommand rejects literal undefined attribute values. */
    ...(jobType === "SCHEDULED" && cadenceCron && schedName ? { cadence_cron: cadenceCron, schedule_name: schedName } : {}),
    created_at: d.now().toISOString(),
    created_by: createdBy,
  };
  await d.jobRunsDao.putDefinition(definition);

  if (jobType === "SCHEDULED" && schedName && cadenceCron) {
    try {
      await d.schedulerClient.send(
        new CreateScheduleCommand({
          Name: schedName,
          GroupName: d.scheduleGroupName,
          ScheduleExpression: cadenceCron,
          FlexibleTimeWindow: { Mode: "OFF" },
          Target: {
            Arn: d.runnerFunctionArn,
            RoleArn: d.scheduleRoleArn,
            Input: JSON.stringify({ job_name: name }),
            DeadLetterConfig: { Arn: d.deadLetterQueueArn },
          },
        })
      );
    } catch (err) {
      logError("WarehouseJobScheduleCreateFailed", { jobName: name, error: err instanceof Error ? err.message : err });
      throw new TerminalError(
        `Job "${name}" was created but its schedule failed to create — delete and recreate it`,
        err
      );
    }
  }

  logInfo("WarehouseJobDefinitionCreateSucceeded", { jobName: name, jobType, scheduleName: schedName });
  return definition;
}

/**
 * Deletes a self-service job or saved query: its schedule (`SCHEDULED`
 * only — a `SAVED_QUERY` has none, so this step is skipped for one), its
 * S3 SQL file, and its DDB definition row — in that order, tolerating an
 * already-gone schedule (`ResourceNotFoundException`). Every past
 * `WarehouseJobRuns` run row and `job-results/` resultset is left
 * untouched (§8's "keep history" design call).
 *
 * @throws {@link NotFoundError} if no job with this name exists.
 */
export async function deleteWarehouseJob(name: string, deps: WarehouseJobDefinitionDeps = {}): Promise<void> {
  const d = resolve(deps);
  const definition = await d.jobRunsDao.getDefinition(name);
  if (!definition) {
    throw new NotFoundError(`No job named "${name}"`);
  }

  if (definition.schedule_name) {
    try {
      await d.schedulerClient.send(new DeleteScheduleCommand({ Name: definition.schedule_name, GroupName: d.scheduleGroupName }));
    } catch (err) {
      if (!(err instanceof Error) || err.name !== "ResourceNotFoundException") {
        logError("WarehouseJobScheduleDeleteFailed", { jobName: name, error: err instanceof Error ? err.message : err });
        throw err;
      }
    }
  }

  await d.s3Client.send(new DeleteObjectCommand({ Bucket: d.warehouseBucket, Key: definition.sql_s3_key }));
  await d.jobRunsDao.deleteDefinition(name);
  logInfo("WarehouseJobDefinitionDeleted", { jobName: name });
}

/** Every registered job definition, most-recently-created first — backs `GET /admin/warehouse/jobs`. */
export async function listWarehouseJobs(deps: WarehouseJobDefinitionDeps = {}): Promise<WarehouseJobDefinition[]> {
  const d = resolve(deps);
  return d.jobRunsDao.listDefinitions();
}

/**
 * Overwrites an existing job's/saved query's SQL — and, for a `SCHEDULED`
 * job, its cadence — in place (`7-data-warehousing.md` §12b). `name`,
 * `sql_s3_key`, and `job_type` never change. A `SAVED_QUERY` has no
 * schedule, so `cadenceCron` is ignored for one even if passed. S3 is
 * overwritten first — harmless if the schedule update below fails, since
 * the schedule just keeps its old cadence rather than pointing at a
 * half-written job.
 *
 * @throws {@link NotFoundError} if no job with this name exists.
 * @throws {@link TerminalError} if a `SCHEDULED` job's schedule fails to update.
 */
export async function updateWarehouseJob(
  name: string,
  sql: string,
  cadenceCron?: string,
  deps: WarehouseJobDefinitionDeps = {}
): Promise<WarehouseJobDefinition> {
  const d = resolve(deps);
  const existing = await d.jobRunsDao.getDefinition(name);
  if (!existing) {
    throw new NotFoundError(`No job named "${name}"`);
  }
  logInfo("WarehouseJobDefinitionUpdateStarted", { jobName: name, jobType: existing.job_type, cadenceCron });

  await d.s3Client.send(
    new PutObjectCommand({ Bucket: d.warehouseBucket, Key: existing.sql_s3_key, Body: sql, ContentType: "text/plain" })
  );

  let updated: WarehouseJobDefinition = existing;
  if (existing.job_type === "SCHEDULED" && existing.schedule_name && cadenceCron) {
    try {
      await d.schedulerClient.send(
        new UpdateScheduleCommand({
          Name: existing.schedule_name,
          GroupName: d.scheduleGroupName,
          ScheduleExpression: cadenceCron,
          FlexibleTimeWindow: { Mode: "OFF" },
          Target: {
            Arn: d.runnerFunctionArn,
            RoleArn: d.scheduleRoleArn,
            Input: JSON.stringify({ job_name: name }),
            DeadLetterConfig: { Arn: d.deadLetterQueueArn },
          },
        })
      );
    } catch (err) {
      logError("WarehouseJobScheduleUpdateFailed", { jobName: name, error: err instanceof Error ? err.message : err });
      throw new TerminalError(`Job "${name}"'s SQL was updated but its schedule failed to update`, err);
    }
    updated = { ...existing, cadence_cron: cadenceCron };
  }
  await d.jobRunsDao.updateDefinition(updated);

  logInfo("WarehouseJobDefinitionUpdateSucceeded", { jobName: name });
  return updated;
}

/**
 * The raw SQL text behind a job definition — read from S3 at its
 * `sql_s3_key` (`7-data-warehousing.md` §12b's "load a job into the query
 * editor" flow). The definition row itself only stores the S3 key, never
 * the SQL text inline.
 *
 * @throws {@link NotFoundError} if no job with this name exists.
 */
export async function getWarehouseJobSql(name: string, deps: WarehouseJobDefinitionDeps = {}): Promise<string> {
  const d = resolve(deps);
  const definition = await d.jobRunsDao.getDefinition(name);
  if (!definition) {
    throw new NotFoundError(`No job named "${name}"`);
  }

  const response = await d.s3Client.send(
    new GetObjectCommand({ Bucket: d.warehouseBucket, Key: definition.sql_s3_key })
  );
  return (await response.Body?.transformToString()) ?? "";
}
