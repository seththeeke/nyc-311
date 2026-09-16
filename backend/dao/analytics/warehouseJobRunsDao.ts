import { ConditionalCheckFailedException } from "@aws-sdk/client-dynamodb";
import { DeleteCommand, GetCommand, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { logInfo } from "../../logger";
import { TerminalError } from "../../models/errors";
import { Dao } from "../dao";
import { WarehouseJobRunSchema, JOB_RUNS_GSI1_PK, type WarehouseJobRun } from "../../models/warehouseJobRun";
import {
  DEFINITIONS_GSI1_PK,
  WarehouseJobDefinitionSchema,
  warehouseJobDefinitionId,
  type WarehouseJobDefinition,
} from "../../models/warehouseJobDefinition";

const RECENT_RUNS_INDEX = "gsi1-recent-runs";

/**
 * DAO for the WarehouseJobRuns table (`7-data-warehousing.md` §9) — a
 * plain per-run history record, not event-sourced. `gsi1-recent-runs`
 * (`gsi1pk` = `JOB#RUNS`, `gsi1sk` = `started_at`) backs the `/data` job
 * list; `gsi2-status` (`gsi2pk` = `status`) backs the retry sweep.
 */
export class WarehouseJobRunsDao extends Dao<WarehouseJobRun> {
  constructor(client: ConstructorParameters<typeof Dao<WarehouseJobRun>>[0], tableName: string) {
    super(client, tableName, WarehouseJobRunSchema, "job_run_id");
  }

  private gsiAttributesFor(run: WarehouseJobRun): Record<string, unknown> {
    return {
      gsi1pk: JOB_RUNS_GSI1_PK,
      gsi1sk: run.started_at,
      gsi2pk: run.status,
      gsi2sk: run.started_at,
    };
  }

  /** Write (or overwrite) a run row. Used for the RUNNING insert and the SUCCEEDED/FAILED update alike. */
  async putJobRun(run: WarehouseJobRun): Promise<void> {
    await this.putItem(run, { additionalAttributes: this.gsiAttributesFor(run) });
  }

  /** Most-recent-first, capped — backs `GET /data/jobs`. */
  async listRecentJobRuns(limit: number): Promise<WarehouseJobRun[]> {
    logInfo("WarehouseJobRunsDao.listRecentJobRuns", { table: this.tableName, limit });
    const result = await this.client.send(
      new QueryCommand({
        TableName: this.tableName,
        IndexName: RECENT_RUNS_INDEX,
        KeyConditionExpression: "gsi1pk = :pk",
        ExpressionAttributeValues: { ":pk": JOB_RUNS_GSI1_PK },
        ScanIndexForward: false,
        Limit: limit,
      })
    );
    return (result.Items ?? []).map((item) => this.validate(item));
  }

  /**
   * The most recent run for a given `job_name`, or `null` if the job has
   * never run. Fetches a small most-recent page and filters in-app —
   * DynamoDB's `FilterExpression` runs after `Limit`, so a plain
   * `Limit: 1` + filter could miss it.
   */
  async getLatestRunForJob(jobName: string): Promise<WarehouseJobRun | null> {
    logInfo("WarehouseJobRunsDao.getLatestRunForJob", { table: this.tableName, jobName });
    const result = await this.client.send(
      new QueryCommand({
        TableName: this.tableName,
        IndexName: RECENT_RUNS_INDEX,
        KeyConditionExpression: "gsi1pk = :pk",
        FilterExpression: "job_name = :jn",
        ExpressionAttributeValues: { ":pk": JOB_RUNS_GSI1_PK, ":jn": jobName },
        ScanIndexForward: false,
        Limit: 25,
      })
    );
    const items = result.Items ?? [];
    return items.length > 0 ? this.validate(items[0]) : null;
  }

  /**
   * The most recent `SUCCEEDED` run for a `job_name`, or `null` — backs
   * `GET /data/jobs/{name}/result`, which needs the latest run that
   * actually produced a `result_location`. Scans a wider page than
   * {@link getLatestRunForJob} since RUNNING/FAILED runs in between don't
   * count.
   */
  async getLatestSucceededRunForJob(jobName: string): Promise<WarehouseJobRun | null> {
    logInfo("WarehouseJobRunsDao.getLatestSucceededRunForJob", { table: this.tableName, jobName });
    const result = await this.client.send(
      new QueryCommand({
        TableName: this.tableName,
        IndexName: RECENT_RUNS_INDEX,
        KeyConditionExpression: "gsi1pk = :pk",
        FilterExpression: "job_name = :jn AND #status = :st",
        ExpressionAttributeNames: { "#status": "status" },
        ExpressionAttributeValues: { ":pk": JOB_RUNS_GSI1_PK, ":jn": jobName, ":st": "SUCCEEDED" },
        ScanIndexForward: false,
        Limit: 100,
      })
    );
    const items = result.Items ?? [];
    return items.length > 0 ? this.validate(items[0]) : null;
  }

  /**
   * A single run by its own primary key, or `null` if no such run exists —
   * backs the admin "view any historical run's result" Reports tab
   * (`7-data-warehousing.md` §12b's addition), unlike
   * {@link getLatestRunForJob}/{@link getLatestSucceededRunForJob} which
   * resolve by `job_name` instead.
   */
  async getJobRun(jobRunId: string): Promise<WarehouseJobRun | null> {
    logInfo("WarehouseJobRunsDao.getJobRun", { table: this.tableName, jobRunId });
    return this.getItem(jobRunId);
  }

  /**
   * Creates a job definition row (`7-data-warehousing.md` §8, Leg 8) —
   * conditioned on the name not already existing, since `job_name` is the
   * one stable identity a job keeps for life. Bypasses {@link putItem}
   * (tied to `WarehouseJobRunSchema`, not this table's other item shape)
   * and validates against `WarehouseJobDefinitionSchema` directly.
   *
   * @throws {@link TerminalError} if a definition with this name already exists.
   */
  async putDefinition(definition: WarehouseJobDefinition): Promise<void> {
    const validated = WarehouseJobDefinitionSchema.parse(definition);
    const item = {
      ...validated,
      gsi1pk: DEFINITIONS_GSI1_PK,
      gsi1sk: validated.created_at,
    };
    logInfo("WarehouseJobRunsDao.putDefinition", { table: this.tableName, jobName: validated.job_name });
    try {
      await this.client.send(
        new PutCommand({
          TableName: this.tableName,
          Item: item,
          ConditionExpression: "attribute_not_exists(job_run_id)",
        })
      );
    } catch (err) {
      if (err instanceof ConditionalCheckFailedException) {
        throw new TerminalError(`A job named "${validated.job_name}" already exists`, err);
      }
      throw err;
    }
  }

  /**
   * Overwrites an existing job definition row unconditionally
   * (`7-data-warehousing.md` §12b's job-edit flow) — unlike
   * {@link putDefinition}, no `attribute_not_exists` check, since the
   * point here is replacing a definition that already exists. The
   * caller carries over `created_at`/`created_by`/`job_run_id`/
   * `schedule_name` from the existing row, so `gsi1sk` (keyed off
   * `created_at`) doesn't shift and the job doesn't jump in the
   * most-recently-created listing.
   */
  async updateDefinition(definition: WarehouseJobDefinition): Promise<void> {
    const validated = WarehouseJobDefinitionSchema.parse(definition);
    const item = {
      ...validated,
      gsi1pk: DEFINITIONS_GSI1_PK,
      gsi1sk: validated.created_at,
    };
    logInfo("WarehouseJobRunsDao.updateDefinition", { table: this.tableName, jobName: validated.job_name });
    await this.client.send(new PutCommand({ TableName: this.tableName, Item: item }));
  }

  /** The job definition for `jobName`, or `null` if none exists (never registered, or deleted). */
  async getDefinition(jobName: string): Promise<WarehouseJobDefinition | null> {
    logInfo("WarehouseJobRunsDao.getDefinition", { table: this.tableName, jobName });
    const result = await this.client.send(
      new GetCommand({ TableName: this.tableName, Key: { job_run_id: warehouseJobDefinitionId(jobName) } })
    );
    return result.Item ? WarehouseJobDefinitionSchema.parse(result.Item) : null;
  }

  /**
   * Deletes a job definition row. Never touches the job's past
   * `WarehouseJobRuns` run rows or `job-results/` output — deleting a job
   * stops future runs, it doesn't erase history (§8's "keep history"
   * design call). A no-op if the definition is already gone.
   */
  async deleteDefinition(jobName: string): Promise<void> {
    logInfo("WarehouseJobRunsDao.deleteDefinition", { table: this.tableName, jobName });
    await this.client.send(
      new DeleteCommand({ TableName: this.tableName, Key: { job_run_id: warehouseJobDefinitionId(jobName) } })
    );
  }

  /** Every job definition, most-recently-created first — backs `GET /admin/warehouse/jobs`. */
  async listDefinitions(): Promise<WarehouseJobDefinition[]> {
    logInfo("WarehouseJobRunsDao.listDefinitions", { table: this.tableName });
    const result = await this.client.send(
      new QueryCommand({
        TableName: this.tableName,
        IndexName: RECENT_RUNS_INDEX,
        KeyConditionExpression: "gsi1pk = :pk",
        ExpressionAttributeValues: { ":pk": DEFINITIONS_GSI1_PK },
        ScanIndexForward: false,
      })
    );
    return (result.Items ?? []).map((item) => WarehouseJobDefinitionSchema.parse(item));
  }
}
