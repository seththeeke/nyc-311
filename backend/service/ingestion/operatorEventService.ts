import type { AttributeValue } from "@aws-sdk/client-dynamodb";
import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";
import { unmarshall } from "@aws-sdk/util-dynamodb";
import { logInfo } from "../../logger";
import { requireEnv } from "../../env";
import type { OperatorStreamRecord } from "../../models/operatorStreamEvent";
import { eventSourcedStreamRecordKind } from "../../dao/eventSourcedStreamRecordKind";

/**
 * Dependencies for {@link fanOutOperatorRecord}. All default to a freshly
 * constructed client/env lookup — tests override them with mocks/fakes.
 */
export interface OperatorFanOutDeps {
  snsClient?: SNSClient;
  eventsTopicArn?: string;
  projectionsTopicArn?: string;
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
  const kind = eventSourcedStreamRecordKind(record);

  if (kind === "EVENT") {
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

  if (kind === "PROJECTION") {
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
