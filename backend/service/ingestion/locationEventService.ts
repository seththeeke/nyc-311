import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";
import type { AttributeValue } from "@aws-sdk/client-dynamodb";
import { unmarshall } from "@aws-sdk/util-dynamodb";
import { logInfo } from "../../logger";
import type { LocationStreamRecord } from "../../models/locationStreamEvent";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

/**
 * Dependencies for {@link fanOutLocationRecord}. Both default to a freshly
 * constructed client/env lookup — tests override them with mocks/fakes.
 */
export interface LocationFanOutDeps {
  snsClient?: SNSClient;
  topicArn?: string;
}

/**
 * A `Locations` row worth fanning out. `Locations` is written once per
 * `bbl` via `findOrCreate` (a conditional `PutItem`) and never updated, so
 * only `INSERT` is expected; a `MODIFY`/`REMOVE` (shouldn't happen) is a
 * no-op. A missing `location_id` excludes any non-entity row.
 */
function isRelevantLocationRecord(record: LocationStreamRecord): boolean {
  return record.eventName === "INSERT" && typeof record.dynamodb.NewImage?.["location_id"] !== "undefined";
}

/**
 * Fans out one new `Location` row onto `Nyc311LocationEventsTopic`, tagged
 * with an `event_name` message attribute so subscribers filter
 * declaratively — same "pure plumbing" shape as
 * `nyc311RequestService.ts`'s `fanOutRequestRecord`. No DAO calls; the
 * `locations` warehouse Firehose is the only subscriber today. An
 * irrelevant record is a normal no-op, never a `batchItemFailure`.
 */
export async function fanOutLocationRecord(
  record: LocationStreamRecord,
  deps: LocationFanOutDeps = {}
): Promise<void> {
  const snsClient = deps.snsClient ?? new SNSClient({});
  const topicArn = deps.topicArn ?? requireEnv("LOCATION_EVENTS_TOPIC_ARN");

  if (!isRelevantLocationRecord(record)) {
    logInfo("LocationStreamRecordSkipped", {
      eventName: record.eventName,
      sequenceNumber: record.dynamodb.SequenceNumber,
    });
    return;
  }

  const location = unmarshall(record.dynamodb.NewImage as Record<string, AttributeValue>);
  logInfo("LocationStreamRecordUnmarshalled", {
    sequenceNumber: record.dynamodb.SequenceNumber,
    locationId: location["location_id"],
  });

  await snsClient.send(
    new PublishCommand({
      TopicArn: topicArn,
      Message: JSON.stringify(location),
      MessageAttributes: {
        event_name: { DataType: "String", StringValue: record.eventName },
      },
    })
  );
  logInfo("LocationStreamRecordFannedOut", {
    sequenceNumber: record.dynamodb.SequenceNumber,
    locationId: location["location_id"],
  });
}
