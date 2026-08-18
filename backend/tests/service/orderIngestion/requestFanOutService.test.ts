import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import { mockClient } from "aws-sdk-client-mock";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fanOutRequestRecord } from "../../../service/orderIngestion/requestFanOutService";
import type { RequestStreamRecord } from "../../../models/requestStreamEvent";

const QUEUE_URL = "https://sqs.us-east-1.amazonaws.com/123456789012/OrderIngestion";
const sqsMock = mockClient(SQSClient);
const sqsClient = new SQSClient({});

function makeRecord(overrides: Partial<RequestStreamRecord> = {}): RequestStreamRecord {
  return {
    eventName: "INSERT",
    dynamodb: {
      NewImage: {
        request_id: { S: "01ABCDEF" },
        external_unique_key: { S: "12345" },
        status: { S: "DRAFT" },
      },
      SequenceNumber: "111",
    },
    ...overrides,
  };
}

beforeEach(() => {
  sqsMock.reset();
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("fanOutRequestRecord", () => {
  it("publishes the unmarshalled NewImage to SQS for a relevant INSERT record", async () => {
    sqsMock.on(SendMessageCommand).resolves({});

    await fanOutRequestRecord(makeRecord(), { sqsClient, queueUrl: QUEUE_URL });

    const calls = sqsMock.commandCalls(SendMessageCommand);
    expect(calls).toHaveLength(1);
    const input = calls[0]?.args[0].input;
    expect(input?.QueueUrl).toBe(QUEUE_URL);
    expect(JSON.parse(input?.MessageBody as string)).toEqual({
      request_id: "01ABCDEF",
      external_unique_key: "12345",
      status: "DRAFT",
    });
  });

  it("skips a MODIFY record without publishing anything", async () => {
    await fanOutRequestRecord(makeRecord({ eventName: "MODIFY" }), { sqsClient, queueUrl: QUEUE_URL });

    expect(sqsMock.calls()).toHaveLength(0);
  });

  it("skips a REMOVE record without publishing anything", async () => {
    await fanOutRequestRecord(makeRecord({ eventName: "REMOVE" }), { sqsClient, queueUrl: QUEUE_URL });

    expect(sqsMock.calls()).toHaveLength(0);
  });

  it("skips an INSERT record with no NewImage at all (e.g. KEYS_ONLY delivery)", async () => {
    await fanOutRequestRecord(
      { eventName: "INSERT", dynamodb: { SequenceNumber: "111" } },
      { sqsClient, queueUrl: QUEUE_URL }
    );

    expect(sqsMock.calls()).toHaveLength(0);
  });

  it("skips an INSERT record whose NewImage has no external_unique_key (the CURSOR#NYC_311 sentinel or a poller-metrics row)", async () => {
    const record = makeRecord({
      dynamodb: {
        NewImage: { last_watermark: { S: "2026-08-10T00:00:00" } },
        SequenceNumber: "222",
      },
    });

    await fanOutRequestRecord(record, { sqsClient, queueUrl: QUEUE_URL });

    expect(sqsMock.calls()).toHaveLength(0);
  });

  it("lets an SQS SendMessage failure propagate", async () => {
    sqsMock.on(SendMessageCommand).rejects(new Error("SQS unavailable"));

    await expect(fanOutRequestRecord(makeRecord(), { sqsClient, queueUrl: QUEUE_URL })).rejects.toThrow(
      "SQS unavailable"
    );
  });

  it("throws when queueUrl isn't provided and ORDER_INGESTION_QUEUE_URL isn't set", async () => {
    const previous = process.env["ORDER_INGESTION_QUEUE_URL"];
    delete process.env["ORDER_INGESTION_QUEUE_URL"];

    try {
      await expect(fanOutRequestRecord(makeRecord(), { sqsClient })).rejects.toThrow(
        "Missing required environment variable: ORDER_INGESTION_QUEUE_URL"
      );
    } finally {
      if (previous !== undefined) process.env["ORDER_INGESTION_QUEUE_URL"] = previous;
    }
  });

  it("falls back to ORDER_INGESTION_QUEUE_URL when queueUrl isn't provided in deps", async () => {
    const previous = process.env["ORDER_INGESTION_QUEUE_URL"];
    process.env["ORDER_INGESTION_QUEUE_URL"] = QUEUE_URL;
    sqsMock.on(SendMessageCommand).resolves({});

    try {
      await fanOutRequestRecord(makeRecord(), { sqsClient });

      const calls = sqsMock.commandCalls(SendMessageCommand);
      expect(calls[0]?.args[0].input.QueueUrl).toBe(QUEUE_URL);
    } finally {
      if (previous === undefined) delete process.env["ORDER_INGESTION_QUEUE_URL"];
      else process.env["ORDER_INGESTION_QUEUE_URL"] = previous;
    }
  });
});
