import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { Dao } from "../dao";
import { logInfo } from "../../logger";
import { TerminalError } from "../../models/errors";
import type { WebhookCustomerFacingOrder } from "../../models/webhookCustomerFacingOrder";
import { WebhookCustomerFacingOrderSchema } from "../../models/webhookCustomerFacingOrder";

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
}
