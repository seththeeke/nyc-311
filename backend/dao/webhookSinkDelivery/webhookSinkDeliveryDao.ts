import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { ScanCommand } from "@aws-sdk/lib-dynamodb";
import { Dao } from "../dao";
import { logInfo } from "../../logger";
import type { WebhookSinkDelivery } from "../../models/webhookSinkDelivery";
import { WebhookSinkDeliverySchema } from "../../models/webhookSinkDelivery";

/**
 * Backs the Test-only webhook sink's delivery records
 * (`13-customer-simulation.md` §5) — keyed by `webhook_id`, expired by TTL
 * after a week, so the table stays a few hundred rows.
 */
export class WebhookSinkDeliveryDao extends Dao<WebhookSinkDelivery> {
  constructor(client: DynamoDBDocumentClient, tableName: string) {
    super(client, tableName, WebhookSinkDeliverySchema, "webhook_id");
  }

  /** Plain overwrite — a redelivered event replaces its earlier record. */
  async putDelivery(delivery: WebhookSinkDelivery): Promise<void> {
    await this.putItem(delivery);
  }

  /** Full Scan — bounded by the table's one-week TTL at Test's ~76 accepted Orders a day. */
  async listDeliveries(): Promise<WebhookSinkDelivery[]> {
    logInfo("WebhookSinkDeliveryDao.listDeliveries", { table: this.tableName });
    const deliveries: WebhookSinkDelivery[] = [];
    let exclusiveStartKey: Record<string, unknown> | undefined;
    do {
      const result = await this.client.send(new ScanCommand({ TableName: this.tableName, ExclusiveStartKey: exclusiveStartKey }));
      for (const item of result.Items ?? []) deliveries.push(this.validate(item));
      exclusiveStartKey = result.LastEvaluatedKey;
    } while (exclusiveStartKey);
    return deliveries;
  }
}
