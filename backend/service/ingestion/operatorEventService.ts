import type { AttributeValue } from "@aws-sdk/client-dynamodb";
import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";
import { unmarshall } from "@aws-sdk/util-dynamodb";
import { logInfo } from "../../logger";
import type { OperatorStreamRecord } from "../../models/operatorStreamEvent";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

/**
 * Dependencies for {@link fanOutOperatorRecord}. All default to a freshly
 * constructed client/env lookup — tests override them with mocks/fakes.
 */
export interface OperatorFanOutDeps {
  snsClient?: SNSClient;
  eventsTopicArn?: string;
  projectionsTopicArn?: string;
}

/** Extracts a string `sk` from a stream record's `NewImage`, or `null`. */
function newImageSk(record: OperatorStreamRecord): string | null {
  const sk = record.dynamodb.NewImage?.["sk"];
  if (typeof sk === "object" && sk !== null && "S" in sk && typeof (sk as { S: unknown }).S === "string") {
    return (sk as { S: string }).S;
  }
  return null;
}

/**
 * True only for an appended `OperatorEvent` — an `INSERT` whose `sk`
 * starts with `EVENT#` (`10-capacity-modeling-and-integration.md` §1.1).
 * Immutable, append-only, so a `MODIFY` never applies here.
 */
function isOperatorEventRecord(record: OperatorStreamRecord): boolean {
  return record.eventName === "INSERT" && (newImageSk(record)?.startsWith("EVENT#") ?? false);
}

/**
 * True for a change to the `#METADATA` projection row — an `INSERT`
 * (Operator added) or a `MODIFY` (every later state transition).
 */
function isOperatorProjectionRecord(record: OperatorStreamRecord): boolean {
  return (record.eventName === "INSERT" || record.eventName === "MODIFY") && newImageSk(record) === "#METADATA";
}

/**
 * Routes one `Operators`-table stream record (`7-data-warehousing.md` §4,
 * Leg 6): an `EVENT#` item onto `Nyc311OperatorEventsTopic` (tagged
 * `event_type`), a `#METADATA` change onto `Nyc311OperatorProjectionsTopic`
 * (tagged `event_name`), everything else a no-op. Unlike `Orders`, neither
 * topic has an operational subscriber — both feed the warehouse only. One
 * stream reader, two outbound topics — pure plumbing, no DAO calls, an
 * irrelevant record never a `batchItemFailure`.
 */
export async function fanOutOperatorRecord(
  record: OperatorStreamRecord,
  deps: OperatorFanOutDeps = {}
): Promise<void> {
  const snsClient = deps.snsClient ?? new SNSClient({});

  if (isOperatorEventRecord(record)) {
    const eventsTopicArn = deps.eventsTopicArn ?? requireEnv("OPERATOR_EVENTS_TOPIC_ARN");
    const operatorEvent = unmarshall(record.dynamodb.NewImage as Record<string, AttributeValue>);
    const eventType = typeof operatorEvent["event_type"] === "string" ? operatorEvent["event_type"] : "UNKNOWN";
    logInfo("OperatorStreamRecordUnmarshalled", {
      sequenceNumber: record.dynamodb.SequenceNumber,
      operatorId: operatorEvent["operator_id"],
      recordType: "EVENT",
      eventType,
    });
    await snsClient.send(
      new PublishCommand({
        TopicArn: eventsTopicArn,
        Message: JSON.stringify(operatorEvent),
        MessageAttributes: { event_type: { DataType: "String", StringValue: eventType } },
      })
    );
    logInfo("OperatorStreamRecordFannedOut", {
      sequenceNumber: record.dynamodb.SequenceNumber,
      operatorId: operatorEvent["operator_id"],
      recordType: "EVENT",
      eventType,
    });
    return;
  }

  if (isOperatorProjectionRecord(record)) {
    const projectionsTopicArn = deps.projectionsTopicArn ?? requireEnv("OPERATOR_PROJECTIONS_TOPIC_ARN");
    const projection = unmarshall(record.dynamodb.NewImage as Record<string, AttributeValue>);
    logInfo("OperatorStreamRecordUnmarshalled", {
      sequenceNumber: record.dynamodb.SequenceNumber,
      operatorId: projection["operator_id"],
      recordType: "PROJECTION",
      eventName: record.eventName,
    });
    await snsClient.send(
      new PublishCommand({
        TopicArn: projectionsTopicArn,
        Message: JSON.stringify(projection),
        MessageAttributes: { event_name: { DataType: "String", StringValue: record.eventName } },
      })
    );
    logInfo("OperatorStreamRecordFannedOut", {
      sequenceNumber: record.dynamodb.SequenceNumber,
      operatorId: projection["operator_id"],
      recordType: "PROJECTION",
      eventName: record.eventName,
    });
    return;
  }

  logInfo("OperatorStreamRecordSkipped", {
    eventName: record.eventName,
    sequenceNumber: record.dynamodb.SequenceNumber,
  });
}
