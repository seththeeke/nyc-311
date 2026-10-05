import { DynamoDBClient, TransactionCanceledException } from "@aws-sdk/client-dynamodb";
import { BatchGetCommand, DynamoDBDocumentClient, TransactWriteCommand } from "@aws-sdk/lib-dynamodb";
import { mockClient } from "aws-sdk-client-mock";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LiveWorkspaceMetricsDao } from "../../../dao/analytics/liveWorkspaceMetricsDao";
import { ValidationError } from "../../../models/errors";

const TABLE = "LiveWorkspaceMetrics-Test";
const ddbMock = mockClient(DynamoDBDocumentClient);
const dao = new LiveWorkspaceMetricsDao(DynamoDBDocumentClient.from(new DynamoDBClient({})), TABLE);
const NOW = new Date("2026-10-06T15:00:00.000Z");

function cancelled(codes: string[]): TransactionCanceledException {
  return new TransactionCanceledException({
    message: "cancelled",
    $metadata: {},
    CancellationReasons: codes.map((Code) => ({ Code })),
  });
}

function transactItems(): Record<string, Record<string, unknown>>[] {
  return ddbMock.commandCalls(TransactWriteCommand)[0].args[0].input.TransactItems as Record<string, Record<string, unknown>>[];
}

beforeEach(() => {
  ddbMock.reset();
  ddbMock.on(TransactWriteCommand).resolves({});
  vi.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("LiveWorkspaceMetricsDao.getDayBuckets", () => {
  it("batch-gets DAY# keys and returns the found buckets keyed by day", async () => {
    ddbMock.on(BatchGetCommand).resolves({
      Responses: {
        [TABLE]: [{ metric_key: "DAY#2026-10-05", day: "2026-10-05", accepted_count: 3, updated_at: "2026-10-05T14:00:00.000Z" }],
      },
    });

    const buckets = await dao.getDayBuckets(["2026-10-05", "2026-10-06"]);

    expect(ddbMock.commandCalls(BatchGetCommand)[0].args[0].input.RequestItems?.[TABLE]?.Keys).toEqual([
      { metric_key: "DAY#2026-10-05" },
      { metric_key: "DAY#2026-10-06" },
    ]);
    expect([...buckets.keys()]).toEqual(["2026-10-05"]);
    expect(buckets.get("2026-10-05")?.accepted_count).toBe(3);
  });

  it("rejects a stored bucket that doesn't match the schema", async () => {
    ddbMock.on(BatchGetCommand).resolves({ Responses: { [TABLE]: [{ metric_key: "DAY#2026-10-05", day: "nope" }] } });

    await expect(dao.getDayBuckets(["2026-10-05"])).rejects.toBeInstanceOf(ValidationError);
  });
});

describe("LiveWorkspaceMetricsDao.recordAccepted", () => {
  it("puts a put-if-absent SEEN marker with a 30-day TTL and increments the day's accepted_count, in one transaction", async () => {
    const counted = await dao.recordAccepted({ orderId: "01ORDER", day: "2026-10-06" }, NOW);

    expect(counted).toBe(true);
    const [marker, bucket] = transactItems();
    expect(marker.Put).toEqual({
      TableName: TABLE,
      Item: {
        metric_key: "SEEN#ORDER_ACCEPTED#01ORDER",
        counted_at: "2026-10-06T15:00:00.000Z",
        expires_at: Math.floor(NOW.getTime() / 1000) + 30 * 24 * 60 * 60,
      },
      ConditionExpression: "attribute_not_exists(metric_key)",
    });
    expect(bucket.Update).toEqual({
      TableName: TABLE,
      Key: { metric_key: "DAY#2026-10-06" },
      UpdateExpression: "SET #day = :day, updated_at = :now ADD accepted_count :one",
      ExpressionAttributeNames: { "#day": "day" },
      ExpressionAttributeValues: { ":day": "2026-10-06", ":now": "2026-10-06T15:00:00.000Z", ":one": 1 },
    });
  });

  it("returns false, without throwing, when the marker already exists (a redelivered event)", async () => {
    ddbMock.on(TransactWriteCommand).rejects(cancelled(["ConditionalCheckFailed", "None"]));

    await expect(dao.recordAccepted({ orderId: "01ORDER", day: "2026-10-06" })).resolves.toBe(false);
  });

  it("rethrows a cancellation that isn't the marker's condition, so the queue retries it", async () => {
    ddbMock.on(TransactWriteCommand).rejects(cancelled(["None", "TransactionConflict"]));

    await expect(dao.recordAccepted({ orderId: "01ORDER", day: "2026-10-06" })).rejects.toBeInstanceOf(TransactionCanceledException);
  });

  it("rethrows a cancellation that carries no reasons at all", async () => {
    ddbMock.on(TransactWriteCommand).rejects(new TransactionCanceledException({ message: "cancelled", $metadata: {} }));

    await expect(dao.recordAccepted({ orderId: "01ORDER", day: "2026-10-06" })).rejects.toBeInstanceOf(TransactionCanceledException);
  });

  it("rethrows any other DynamoDB failure", async () => {
    ddbMock.on(TransactWriteCommand).rejects(new Error("throttled"));

    await expect(dao.recordAccepted({ orderId: "01ORDER", day: "2026-10-06" })).rejects.toThrow("throttled");
  });
});

describe("LiveWorkspaceMetricsDao.recordResolved", () => {
  it("adds the count, both sums, and appends the duration to the day's list, guarded by its own marker", async () => {
    const counted = await dao.recordResolved({ orderId: "01ORDER", day: "2026-10-06", resolutionSeconds: 5400, totalCost: 187.5 }, NOW);

    expect(counted).toBe(true);
    const [marker, bucket] = transactItems();
    expect((marker.Put as { Item: Record<string, unknown> }).Item.metric_key).toBe("SEEN#ORDER_RESOLVED#01ORDER");
    expect(bucket.Update).toEqual({
      TableName: TABLE,
      Key: { metric_key: "DAY#2026-10-06" },
      UpdateExpression:
        "SET #day = :day, updated_at = :now, " +
        "resolution_seconds = list_append(if_not_exists(resolution_seconds, :empty), :duration) " +
        "ADD resolved_count :one, resolution_seconds_sum :seconds, total_cost_sum :cost",
      ExpressionAttributeNames: { "#day": "day" },
      ExpressionAttributeValues: {
        ":day": "2026-10-06",
        ":now": "2026-10-06T15:00:00.000Z",
        ":one": 1,
        ":seconds": 5400,
        ":cost": 187.5,
        ":empty": [],
        ":duration": [5400],
      },
    });
  });

  it("returns false for a duplicate resolution, defaulting `now` when not given", async () => {
    ddbMock.on(TransactWriteCommand).rejects(cancelled(["ConditionalCheckFailed", "None"]));

    await expect(dao.recordResolved({ orderId: "01ORDER", day: "2026-10-06", resolutionSeconds: 60, totalCost: 1 })).resolves.toBe(false);
  });
});
