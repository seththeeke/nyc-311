import type { AttributeValue } from "@aws-sdk/client-dynamodb";
import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";
import { unmarshall } from "@aws-sdk/util-dynamodb";
import { logInfo } from "../../logger";
import type { OrderStreamRecord } from "../../models/orderStreamEvent";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

/**
 * Dependencies for {@link fanOutOrderEvent}. Both default to a freshly
 * constructed client/env lookup — tests override them with mocks/fakes.
 */
export interface OrderEventFanOutDeps {
  snsClient?: SNSClient;
  topicArn?: string;
}

/**
 * True only for an appended `OrderEvent` (an `INSERT` whose `sk` starts
 * with `EVENT#`) — never the `#METADATA` projection item, per
 * `5-order-evaluation.md` §3's "forward every OrderEvent, not just
 * creation" decision. The projection's own writes are always either an
 * `INSERT` of `#METADATA` (creation) or a `MODIFY` (every later update) —
 * neither matches this check, so the fan-out only ever forwards Order's
 * source-of-truth event log, never its derived, read-optimized cache.
 */
function isOrderEventRecord(record: OrderStreamRecord): boolean {
  if (record.eventName !== "INSERT") return false;
  const sk = record.dynamodb.NewImage?.["sk"];
  return (
    typeof sk === "object" &&
    sk !== null &&
    "S" in sk &&
    typeof (sk as { S: unknown }).S === "string" &&
    (sk as { S: string }).S.startsWith("EVENT#")
  );
}

/**
 * Fans out one appended `OrderEvent` onto `Nyc311OrderEventsTopic`, tagged
 * with an `event_type` message attribute so downstream SQS subscriptions
 * can filter declaratively (`5-order-evaluation.md` §3) — no relevance
 * logic lives past this Lambda; everything downstream is a filter policy,
 * not code. No DAO calls, same "pure plumbing" shape as
 * `nyc311RequestService.ts`'s `fanOutRequestRecord`. An irrelevant record
 * is a normal no-op, never a `batchItemFailure`.
 */
export async function fanOutOrderEvent(record: OrderStreamRecord, deps: OrderEventFanOutDeps = {}): Promise<void> {
  const snsClient = deps.snsClient ?? new SNSClient({});
  const topicArn = deps.topicArn ?? requireEnv("ORDER_EVENTS_TOPIC_ARN");

  if (!isOrderEventRecord(record)) {
    logInfo("OrderStreamRecordSkipped", {
      eventName: record.eventName,
      sequenceNumber: record.dynamodb.SequenceNumber,
    });
    return;
  }

  const orderEvent = unmarshall(record.dynamodb.NewImage as Record<string, AttributeValue>);
  const eventType = typeof orderEvent["event_type"] === "string" ? orderEvent["event_type"] : "UNKNOWN";
  logInfo("OrderStreamRecordUnmarshalled", {
    sequenceNumber: record.dynamodb.SequenceNumber,
    orderId: orderEvent["order_id"],
    eventType,
  });

  await snsClient.send(
    new PublishCommand({
      TopicArn: topicArn,
      Message: JSON.stringify(orderEvent),
      MessageAttributes: {
        event_type: { DataType: "String", StringValue: eventType },
      },
    })
  );
  logInfo("OrderStreamRecordFannedOut", {
    sequenceNumber: record.dynamodb.SequenceNumber,
    orderId: orderEvent["order_id"],
    eventType,
  });
}
