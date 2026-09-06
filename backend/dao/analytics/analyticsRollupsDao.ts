import { QueryCommand } from "@aws-sdk/lib-dynamodb";
import { logInfo } from "../../logger";
import { Dao } from "../dao";
import { AnalyticsRollupSchema, type AnalyticsRollup } from "../../models/analyticsRollup";

/**
 * DAO for the AnalyticsRollups table (`7-data-warehousing.md` §8) — the
 * dashboard-ready output of each Athena job, keyed `metric_view` (PK) +
 * `rollup_key` (SK, `<run_date>#<dimension>`). Plain record.
 */
export class AnalyticsRollupsDao extends Dao<AnalyticsRollup> {
  constructor(client: ConstructorParameters<typeof Dao<AnalyticsRollup>>[0], tableName: string) {
    super(client, tableName, AnalyticsRollupSchema, "metric_view");
  }

  /** Base-table PK is `metric_view`; the composite key needs `rollup_key` as the SK for a real put. */
  async putRollup(rollup: AnalyticsRollup): Promise<void> {
    await this.putItem(rollup);
  }

  /** All rows for one view, most-recent `rollup_key` first. */
  async listRollups(metricView: string, limit: number): Promise<AnalyticsRollup[]> {
    logInfo("AnalyticsRollupsDao.listRollups", { table: this.tableName, metricView, limit });
    const result = await this.client.send(
      new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: "metric_view = :mv",
        ExpressionAttributeValues: { ":mv": metricView },
        ScanIndexForward: false,
        Limit: limit,
      })
    );
    return (result.Items ?? []).map((item) => this.validate(item));
  }
}
