import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";
import { mockClient } from "aws-sdk-client-mock";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fanOutOrderEvent } from "../../../service/order/orderEvaluationService";
import type { OrderStreamRecord } from "../../../models/orderStreamEvent";

const TOPIC_ARN = "arn:aws:sns:us-east-1:123456789012:Nyc311OrderEvents-Test";
const snsMock = mockClient(SNSClient);
const snsClient = new SNSClient({});

function makeStreamRecord(overrides: Partial<OrderStreamRecord> = {}): OrderStreamRecord {
  return {
    eventName: "INSERT",
    dynamodb: {
      NewImage: {
        order_id: { S: "01ORDER" },
        sk: { S: "EVENT#0" },
        event_type: { S: "ORDER_CREATED" },
      },
      SequenceNumber: "111",
    },
    ...overrides,
  };
}

beforeEach(() => {
  snsMock.reset();
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("fanOutOrderEvent", () => {
  it("publishes the unmarshalled EVENT# item to SNS, tagged with its event_type message attribute", async () => {
    snsMock.on(PublishCommand).resolves({});

    await fanOutOrderEvent(makeStreamRecord(), { snsClient, topicArn: TOPIC_ARN });

    const calls = snsMock.commandCalls(PublishCommand);
    expect(calls).toHaveLength(1);
    const input = calls[0]?.args[0].input;
    expect(input?.TopicArn).toBe(TOPIC_ARN);
    expect(JSON.parse(input?.Message as string)).toEqual({
      order_id: "01ORDER",
      sk: "EVENT#0",
      event_type: "ORDER_CREATED",
    });
    expect(input?.MessageAttributes).toEqual({
      event_type: { DataType: "String", StringValue: "ORDER_CREATED" },
    });
  });

  it("skips a MODIFY record (the #METADATA projection's own update) without publishing anything", async () => {
    await fanOutOrderEvent(makeStreamRecord({ eventName: "MODIFY" }), { snsClient, topicArn: TOPIC_ARN });

    expect(snsMock.calls()).toHaveLength(0);
  });

  it("skips a REMOVE record without publishing anything", async () => {
    await fanOutOrderEvent(makeStreamRecord({ eventName: "REMOVE" }), { snsClient, topicArn: TOPIC_ARN });

    expect(snsMock.calls()).toHaveLength(0);
  });

  it("skips an INSERT record with no NewImage at all (e.g. KEYS_ONLY delivery)", async () => {
    await fanOutOrderEvent(
      { eventName: "INSERT", dynamodb: { SequenceNumber: "111" } },
      { snsClient, topicArn: TOPIC_ARN }
    );

    expect(snsMock.calls()).toHaveLength(0);
  });

  it("skips an INSERT of the #METADATA projection item (sk doesn't start with EVENT#)", async () => {
    const record = makeStreamRecord({
      dynamodb: {
        NewImage: { order_id: { S: "01ORDER" }, sk: { S: "#METADATA" }, status: { S: "CREATED" } },
        SequenceNumber: "222",
      },
    });

    await fanOutOrderEvent(record, { snsClient, topicArn: TOPIC_ARN });

    expect(snsMock.calls()).toHaveLength(0);
  });

  it("skips an INSERT record whose NewImage has no sk attribute at all", async () => {
    const record = makeStreamRecord({
      dynamodb: { NewImage: { order_id: { S: "01ORDER" } }, SequenceNumber: "333" },
    });

    await fanOutOrderEvent(record, { snsClient, topicArn: TOPIC_ARN });

    expect(snsMock.calls()).toHaveLength(0);
  });

  it("skips an INSERT record whose sk attribute isn't a string (S) AttributeValue", async () => {
    const record = makeStreamRecord({
      dynamodb: { NewImage: { order_id: { S: "01ORDER" }, sk: { N: "1" } }, SequenceNumber: "444" },
    });

    await fanOutOrderEvent(record, { snsClient, topicArn: TOPIC_ARN });

    expect(snsMock.calls()).toHaveLength(0);
  });

  it("tags a missing/non-string event_type as UNKNOWN rather than throwing", async () => {
    snsMock.on(PublishCommand).resolves({});
    const record = makeStreamRecord({
      dynamodb: {
        NewImage: { order_id: { S: "01ORDER" }, sk: { S: "EVENT#0" } },
        SequenceNumber: "555",
      },
    });

    await fanOutOrderEvent(record, { snsClient, topicArn: TOPIC_ARN });

    const input = snsMock.commandCalls(PublishCommand)[0]?.args[0].input;
    expect(input?.MessageAttributes).toEqual({
      event_type: { DataType: "String", StringValue: "UNKNOWN" },
    });
  });

  it("lets an SNS Publish failure propagate", async () => {
    snsMock.on(PublishCommand).rejects(new Error("SNS unavailable"));

    await expect(fanOutOrderEvent(makeStreamRecord(), { snsClient, topicArn: TOPIC_ARN })).rejects.toThrow(
      "SNS unavailable"
    );
  });

  it("throws when topicArn isn't provided and ORDER_EVENTS_TOPIC_ARN isn't set", async () => {
    const previous = process.env["ORDER_EVENTS_TOPIC_ARN"];
    delete process.env["ORDER_EVENTS_TOPIC_ARN"];

    try {
      await expect(fanOutOrderEvent(makeStreamRecord(), { snsClient })).rejects.toThrow(
        "Missing required environment variable: ORDER_EVENTS_TOPIC_ARN"
      );
    } finally {
      if (previous !== undefined) process.env["ORDER_EVENTS_TOPIC_ARN"] = previous;
    }
  });

  it("falls back to ORDER_EVENTS_TOPIC_ARN when topicArn isn't provided in deps", async () => {
    const previous = process.env["ORDER_EVENTS_TOPIC_ARN"];
    process.env["ORDER_EVENTS_TOPIC_ARN"] = TOPIC_ARN;
    snsMock.on(PublishCommand).resolves({});

    try {
      await fanOutOrderEvent(makeStreamRecord(), { snsClient });

      const calls = snsMock.commandCalls(PublishCommand);
      expect(calls[0]?.args[0].input.TopicArn).toBe(TOPIC_ARN);
    } finally {
      if (previous === undefined) delete process.env["ORDER_EVENTS_TOPIC_ARN"];
      else process.env["ORDER_EVENTS_TOPIC_ARN"] = previous;
    }
  });

  it("falls back to a freshly constructed SNSClient when snsClient isn't provided in deps", async () => {
    const previous = process.env["ORDER_EVENTS_TOPIC_ARN"];
    process.env["ORDER_EVENTS_TOPIC_ARN"] = TOPIC_ARN;
    snsMock.on(PublishCommand).resolves({});

    try {
      await fanOutOrderEvent(makeStreamRecord());

      expect(snsMock.commandCalls(PublishCommand)).toHaveLength(1);
    } finally {
      if (previous === undefined) delete process.env["ORDER_EVENTS_TOPIC_ARN"];
      else process.env["ORDER_EVENTS_TOPIC_ARN"] = previous;
    }
  });
});
