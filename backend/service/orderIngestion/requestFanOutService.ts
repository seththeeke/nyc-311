import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import { unmarshall } from "@aws-sdk/util-dynamodb";
import type { AttributeValue } from "@aws-sdk/client-dynamodb";
import { logInfo } from "../../logger";
import type { RequestStreamRecord } from "../../models/requestStreamEvent";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

// Constructed once at module scope (Lambda cold start) and reused across
// warm invocations, per CLAUDE.md §5.2 — same pattern as
// `service/ingestion/nyc311PollerService.ts`'s `defaultRequestDao`.
const defaultSqsClient = new SQSClient({});

/**
 * Dependencies for {@link fanOutRequestRecord}. Both default to this
 * module's own singletons — tests override them with mocks/fakes.
 */
export interface RequestFanOutDeps {
  sqsClient?: SQSClient;
  queueUrl?: string;
}

/**
 * Decides whether a DynamoDB Streams record is a real, newly-ingested
 * `Request` worth acting on — per `3-order-ingestion.md` §2.1's in-handler
 * filtering design (deliberately not `FilterCriteria` on the event source
 * mapping). `eventName !== "INSERT"` excludes this pipeline's own
 * promote-and-write-back `MODIFY`s; a missing `external_unique_key`
 * excludes the `CURSOR#NYC_311` sentinel and every poller-metrics
 * `METRIC#<ulid>` row, neither of which ever sets that field.
 */
function isRelevantRequestRecord(record: RequestStreamRecord): boolean {
  return record.eventName === "INSERT" && typeof record.dynamodb.NewImage?.["external_unique_key"] !== "undefined";
}

/**
 * Fans out one relevant `Request` INSERT from the `Requests` table stream
 * onto the order-ingestion SQS queue, per `3-order-ingestion.md` §2.1's
 * two-stage design — this Lambda does nothing else: no filter/promotion
 * logic, no DAO calls. The downstream request-processor Lambda (not yet
 * built) consumes from that queue and owns all of that.
 *
 * Publishes the unmarshalled `NewImage` as plain JSON (agreed 2026-08-18,
 * §2.1) rather than the raw DynamoDB AttributeValue format, so the
 * downstream processor's controller parses a plain JSON payload — the
 * `zod`-validation step per CLAUDE.md §5.2 still belongs entirely to that
 * controller, not here.
 *
 * A record found irrelevant is a normal, successful no-op — never an
 * error — so it's never reported as a `batchItemFailure` by the caller.
 */
export async function fanOutRequestRecord(record: RequestStreamRecord, deps: RequestFanOutDeps = {}): Promise<void> {
  const sqsClient = deps.sqsClient ?? defaultSqsClient;
  const queueUrl = deps.queueUrl ?? requireEnv("ORDER_INGESTION_QUEUE_URL");

  if (!isRelevantRequestRecord(record)) {
    logInfo("RequestStreamRecordSkipped", {
      eventName: record.eventName,
      sequenceNumber: record.dynamodb.SequenceNumber,
    });
    return;
  }

  const request = unmarshall(record.dynamodb.NewImage as Record<string, AttributeValue>);
  logInfo("RequestStreamRecordUnmarshalled", {
    sequenceNumber: record.dynamodb.SequenceNumber,
    requestId: request["request_id"],
  });

  await sqsClient.send(
    new SendMessageCommand({
      QueueUrl: queueUrl,
      MessageBody: JSON.stringify(request),
    })
  );
  logInfo("RequestStreamRecordFannedOut", {
    sequenceNumber: record.dynamodb.SequenceNumber,
    requestId: request["request_id"],
  });
}
