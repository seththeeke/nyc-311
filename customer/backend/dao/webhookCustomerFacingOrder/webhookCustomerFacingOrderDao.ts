import { BatchGetCommand, type BatchGetCommandOutput, QueryCommand, type DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { Dao } from "../dao";
import { logInfo } from "../../logger";
import { TerminalError } from "../../models/errors";
import type { WebhookCustomerFacingOrder } from "../../models/webhookCustomerFacingOrder";
import { WebhookCustomerFacingOrderSchema } from "../../models/webhookCustomerFacingOrder";

export const OPEN_BY_BOROUGH_INDEX = "OpenByBorough";
const BATCH_GET_LIMIT = 100;

/**
 * Backs `WebhookCustomerFacingOrder` — one row per order, keyed by
 * `order_id`. The two writes are idempotent and work in either arrival
 * order, so no separate dedupe store exists.
 */
export class WebhookCustomerFacingOrderDao extends Dao<WebhookCustomerFacingOrder> {
  constructor(client: DynamoDBDocumentClient, tableName: string) {
    super(client, tableName, WebhookCustomerFacingOrderSchema, "order_id");
  }

  async getOrder(orderId: string): Promise<WebhookCustomerFacingOrder | null> {
    return this.getItem(orderId);
  }

  /**
   * Creates the row only if the order is not already known — a duplicate
   * accept, or one arriving after the resolve, changes nothing.
   *
   * @returns `false` if a row already existed.
   */
  async openOrder(order: WebhookCustomerFacingOrder): Promise<boolean> {
    try {
      await this.putItem(order, { conditionExpression: "attribute_not_exists(order_id)" });
      return true;
    } catch (err) {
      if (err instanceof TerminalError) {
        logInfo("WebhookCustomerFacingOrderDao.openOrder.alreadyKnown", { table: this.tableName, orderId: order.order_id });
        return false;
      }
      throw err;
    }
  }

  /** Writes the row as given, creating it if the accept never arrived. Unconditional, so a repeat is harmless. */
  async closeOrder(order: WebhookCustomerFacingOrder): Promise<void> {
    await this.putItem(order);
  }

  /**
   * Open orders in one borough, read from `pickKey` onward in the sparse
   * OpenByBorough index, wrapping to the start when the read runs off the
   * end (§2 customer side, decision 5). At most `limit` rows.
   */
  async sampleOpenOrders(borough: string, pickKey: string, limit: number): Promise<WebhookCustomerFacingOrder[]> {
    logInfo("WebhookCustomerFacingOrderDao.sampleOpenOrders", { table: this.tableName, index: OPEN_BY_BOROUGH_INDEX, borough, pickKey, limit });
    const after = await this.queryOpen(borough, limit, "pick_key >= :pick", pickKey);
    if (after.length >= limit) return after;
    const wrapped = await this.queryOpen(borough, limit - after.length, "pick_key < :pick", pickKey);
    return [...after, ...wrapped];
  }

  /** The rows for these ids, in no particular order; ids with no row are left out. */
  async batchGetOrders(orderIds: string[]): Promise<WebhookCustomerFacingOrder[]> {
    const unique = [...new Set(orderIds)];
    if (unique.length === 0) return [];
    logInfo("WebhookCustomerFacingOrderDao.batchGetOrders", { table: this.tableName, orderIds: unique });
    const found: WebhookCustomerFacingOrder[] = [];
    for (let i = 0; i < unique.length; i += BATCH_GET_LIMIT) {
      let keys: Record<string, unknown>[] | undefined = unique.slice(i, i + BATCH_GET_LIMIT).map((orderId) => ({ order_id: orderId }));
      /* One retry for keys DynamoDB hands back unprocessed; anything still missing just renders without detail. */
      for (let attempt = 0; attempt < 2 && keys && keys.length > 0; attempt++) {
        const result: BatchGetCommandOutput = await this.client.send(new BatchGetCommand({ RequestItems: { [this.tableName]: { Keys: keys } } }));
        found.push(...(result.Responses?.[this.tableName] ?? []).map((item: Record<string, unknown>) => this.validate(item)));
        keys = result.UnprocessedKeys?.[this.tableName]?.Keys;
      }
    }
    return found;
  }

  private async queryOpen(borough: string, limit: number, condition: string, pickKey: string): Promise<WebhookCustomerFacingOrder[]> {
    const result = await this.client.send(
      new QueryCommand({
        TableName: this.tableName,
        IndexName: OPEN_BY_BOROUGH_INDEX,
        KeyConditionExpression: `open_borough = :borough AND ${condition}`,
        ExpressionAttributeValues: { ":borough": borough, ":pick": pickKey },
        Limit: limit,
      })
    );
    return (result.Items ?? []).map((item) => this.validate(item));
  }
}
