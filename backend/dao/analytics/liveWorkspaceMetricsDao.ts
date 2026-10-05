import { TransactionCanceledException } from "@aws-sdk/client-dynamodb";
import { TransactWriteCommand, type DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { logInfo } from "../../logger";
import { Dao } from "../dao";
import {
  LiveMetricsDayBucketSchema,
  dayBucketKey,
  type LiveMetricsDayBucket,
} from "../../models/liveWorkspaceMetrics";

/* How long a "this Order was already counted" marker outlives its event — well past the queue's 14-day DLQ retention. */
const SEEN_MARKER_TTL_SECONDS = 30 * 24 * 60 * 60;

type CountedEventType = "ORDER_ACCEPTED" | "ORDER_RESOLVED";

export interface RecordAcceptedInput {
  orderId: string;
  /** New York calendar date (`YYYY-MM-DD`) the acceptance falls on. */
  day: string;
}

export interface RecordResolvedInput {
  orderId: string;
  /** New York calendar date (`YYYY-MM-DD`) the resolution falls on. */
  day: string;
  resolutionSeconds: number;
  /** Labor plus materials, USD, unrounded. */
  totalCost: number;
}

/**
 * DAO for the LiveWorkspaceMetrics table — one `DAY#<date>` bucket per New
 * York calendar day, plus a TTL'd `SEEN#` marker per counted Order event.
 * Each write is one transaction (marker put-if-absent + bucket increment),
 * so an at-least-once redelivery can never double count.
 */
export class LiveWorkspaceMetricsDao extends Dao<LiveMetricsDayBucket> {
  constructor(client: DynamoDBDocumentClient, tableName: string) {
    super(client, tableName, LiveMetricsDayBucketSchema, "metric_key");
  }

  /** Buckets for the given days, keyed by day; a day nothing happened on is simply absent. */
  async getDayBuckets(days: string[]): Promise<Map<string, LiveMetricsDayBucket>> {
    const items = await this.batchGetItems(days.map(dayBucketKey));
    return new Map([...items.values()].map((bucket) => [bucket.day, bucket]));
  }

  /** @returns `false` if this Order's acceptance was already counted. */
  async recordAccepted(input: RecordAcceptedInput, now: Date = new Date()): Promise<boolean> {
    logInfo("LiveWorkspaceMetricsDao.recordAccepted", { table: this.tableName, input });
    return this.incrementOnce("ORDER_ACCEPTED", input.orderId, now, {
      Key: { metric_key: dayBucketKey(input.day) },
      UpdateExpression: "SET #day = :day, updated_at = :now ADD accepted_count :one",
      ExpressionAttributeNames: { "#day": "day" },
      ExpressionAttributeValues: { ":day": input.day, ":now": now.toISOString(), ":one": 1 },
    });
  }

  /** @returns `false` if this Order's resolution was already counted. */
  async recordResolved(input: RecordResolvedInput, now: Date = new Date()): Promise<boolean> {
    logInfo("LiveWorkspaceMetricsDao.recordResolved", { table: this.tableName, input });
    return this.incrementOnce("ORDER_RESOLVED", input.orderId, now, {
      Key: { metric_key: dayBucketKey(input.day) },
      UpdateExpression:
        "SET #day = :day, updated_at = :now, " +
        "resolution_seconds = list_append(if_not_exists(resolution_seconds, :empty), :duration) " +
        "ADD resolved_count :one, resolution_seconds_sum :seconds, total_cost_sum :cost",
      ExpressionAttributeNames: { "#day": "day" },
      ExpressionAttributeValues: {
        ":day": input.day,
        ":now": now.toISOString(),
        ":one": 1,
        ":seconds": input.resolutionSeconds,
        ":cost": input.totalCost,
        ":empty": [],
        ":duration": [input.resolutionSeconds],
      },
    });
  }

  /**
   * Applies `update` to a day bucket only if no marker exists yet for this
   * Order + event type. A cancelled marker condition means "duplicate" and
   * returns `false`; any other cancellation (e.g. a transaction conflict
   * on the bucket) rethrows so the queue retries it.
   */
  private async incrementOnce(
    eventType: CountedEventType,
    orderId: string,
    now: Date,
    update: {
      Key: Record<string, unknown>;
      UpdateExpression: string;
      ExpressionAttributeNames: Record<string, string>;
      ExpressionAttributeValues: Record<string, unknown>;
    }
  ): Promise<boolean> {
    try {
      await this.client.send(
        new TransactWriteCommand({
          TransactItems: [
            {
              Put: {
                TableName: this.tableName,
                Item: {
                  metric_key: `SEEN#${eventType}#${orderId}`,
                  counted_at: now.toISOString(),
                  expires_at: Math.floor(now.getTime() / 1000) + SEEN_MARKER_TTL_SECONDS,
                },
                ConditionExpression: "attribute_not_exists(metric_key)",
              },
            },
            { Update: { TableName: this.tableName, ...update } },
          ],
        })
      );
      return true;
    } catch (err) {
      if (err instanceof TransactionCanceledException && err.CancellationReasons?.[0]?.Code === "ConditionalCheckFailed") {
        return false;
      }
      throw err;
    }
  }
}
