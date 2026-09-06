import { QueryCommand } from "@aws-sdk/lib-dynamodb";
import { logInfo } from "../../logger";
import { Dao } from "../dao";
import { WarehouseJobRunSchema, JOB_RUNS_GSI1_PK, type WarehouseJobRun } from "../../models/warehouseJobRun";

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
}
