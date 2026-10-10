import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { ScanCommand } from "@aws-sdk/lib-dynamodb";
import { Dao } from "../dao";
import { logInfo } from "../../logger";
import type { WebhookSubscription } from "../../models/webhookSubscription";
import { WebhookSubscriptionSchema } from "../../models/webhookSubscription";

/**
 * Backs `WebhookSubscription` (`13-customer-simulation.md` §2) — a plain
 * record keyed by `subscription_id`. Writes are condition-checked so a
 * create never clobbers a row and a replace never lands on a stale version.
 */
export class WebhookSubscriptionDao extends Dao<WebhookSubscription> {
  constructor(client: DynamoDBDocumentClient, tableName: string) {
    super(client, tableName, WebhookSubscriptionSchema, "subscription_id");
  }

  async getSubscription(subscriptionId: string): Promise<WebhookSubscription | null> {
    return this.getItem(subscriptionId);
  }

  /**
   * Full, strongly consistent Scan — bounded by the subscription cap
   * enforced at create, so a subscription paused a moment ago is never
   * delivered to.
   */
  async listSubscriptions(): Promise<WebhookSubscription[]> {
    logInfo("WebhookSubscriptionDao.listSubscriptions", { table: this.tableName });
    const subscriptions: WebhookSubscription[] = [];
    let exclusiveStartKey: Record<string, unknown> | undefined;
    do {
      const result = await this.client.send(
        new ScanCommand({ TableName: this.tableName, ConsistentRead: true, ExclusiveStartKey: exclusiveStartKey })
      );
      for (const item of result.Items ?? []) subscriptions.push(this.validate(item));
      exclusiveStartKey = result.LastEvaluatedKey;
    } while (exclusiveStartKey);
    return subscriptions;
  }

  /** @throws {@link TerminalError} if a subscription with this id already exists. */
  async createSubscription(subscription: WebhookSubscription): Promise<void> {
    await this.putItem(subscription, { conditionExpression: "attribute_not_exists(subscription_id)" });
  }

  /** @throws {@link TerminalError} if the stored row is missing or its version isn't `expectedVersion`. */
  async replaceSubscription(subscription: WebhookSubscription, expectedVersion: number): Promise<void> {
    await this.putItem(subscription, {
      conditionExpression: "attribute_exists(subscription_id) AND #version = :expectedVersion",
      conditionExpressionNames: { "#version": "version" },
      conditionExpressionValues: { ":expectedVersion": expectedVersion },
    });
  }
}
