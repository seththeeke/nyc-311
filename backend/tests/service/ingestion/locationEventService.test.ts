import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";
import { mockClient } from "aws-sdk-client-mock";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fanOutLocationRecord } from "../../../service/ingestion/locationEventService";
import type { LocationStreamRecord } from "../../../models/locationStreamEvent";

const snsMock = mockClient(SNSClient);
const snsClient = new SNSClient({});
const TOPIC_ARN = "arn:aws:sns:us-east-1:123456789012:Nyc311LocationEvents-Test";

function streamRecord(overrides: Partial<LocationStreamRecord> = {}): LocationStreamRecord {
  return {
    eventName: "INSERT",
    dynamodb: {
      NewImage: {
        location_id: { S: "1000000000" },
        bbl: { S: "1000000000" },
        borough: { S: "MANHATTAN" },
        created_at: { S: "2026-09-07T00:00:00.000Z" },
      },
      SequenceNumber: "1",
    },
    ...overrides,
  } as LocationStreamRecord;
}

beforeEach(() => {
  snsMock.reset();
  vi.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("fanOutLocationRecord", () => {
  it("publishes the unmarshalled NewImage to SNS for a relevant INSERT, tagged event_name=INSERT", async () => {
    snsMock.on(PublishCommand).resolves({});

    await fanOutLocationRecord(streamRecord(), { snsClient, topicArn: TOPIC_ARN });

    const calls = snsMock.commandCalls(PublishCommand);
    expect(calls).toHaveLength(1);
    const input = calls[0]?.args[0].input;
    expect(input?.TopicArn).toBe(TOPIC_ARN);
    expect(JSON.parse(input?.Message as string)).toEqual({
      location_id: "1000000000",
      bbl: "1000000000",
      borough: "MANHATTAN",
      created_at: "2026-09-07T00:00:00.000Z",
    });
    expect(input?.MessageAttributes).toEqual({ event_name: { DataType: "String", StringValue: "INSERT" } });
  });

  it("skips a MODIFY / REMOVE record (Locations is never updated)", async () => {
    await fanOutLocationRecord(streamRecord({ eventName: "MODIFY" }), { snsClient, topicArn: TOPIC_ARN });
    await fanOutLocationRecord(streamRecord({ eventName: "REMOVE" }), { snsClient, topicArn: TOPIC_ARN });
    expect(snsMock.calls()).toHaveLength(0);
  });

  it("skips an INSERT with no NewImage and one with no location_id", async () => {
    await fanOutLocationRecord(
      { eventName: "INSERT", dynamodb: { SequenceNumber: "2" } } as LocationStreamRecord,
      { snsClient, topicArn: TOPIC_ARN }
    );
    await fanOutLocationRecord(
      streamRecord({ dynamodb: { NewImage: { bbl: { S: "x" } }, SequenceNumber: "3" } }),
      { snsClient, topicArn: TOPIC_ARN }
    );
    expect(snsMock.calls()).toHaveLength(0);
  });

  it("lets an SNS Publish failure propagate", async () => {
    snsMock.on(PublishCommand).rejects(new Error("SNS unavailable"));
    await expect(fanOutLocationRecord(streamRecord(), { snsClient, topicArn: TOPIC_ARN })).rejects.toThrow(
      "SNS unavailable"
    );
  });

  it("throws when topicArn isn't provided and LOCATION_EVENTS_TOPIC_ARN isn't set", async () => {
    const prev = process.env["LOCATION_EVENTS_TOPIC_ARN"];
    delete process.env["LOCATION_EVENTS_TOPIC_ARN"];
    try {
      await expect(fanOutLocationRecord(streamRecord(), { snsClient })).rejects.toThrow(
        "Missing required environment variable: LOCATION_EVENTS_TOPIC_ARN"
      );
    } finally {
      if (prev !== undefined) process.env["LOCATION_EVENTS_TOPIC_ARN"] = prev;
    }
  });

  it("falls back to LOCATION_EVENTS_TOPIC_ARN and a fresh SNSClient when deps are omitted", async () => {
    const prev = process.env["LOCATION_EVENTS_TOPIC_ARN"];
    process.env["LOCATION_EVENTS_TOPIC_ARN"] = TOPIC_ARN;
    snsMock.on(PublishCommand).resolves({});
    try {
      await fanOutLocationRecord(streamRecord());
      expect(snsMock.commandCalls(PublishCommand)).toHaveLength(1);
    } finally {
      if (prev === undefined) delete process.env["LOCATION_EVENTS_TOPIC_ARN"];
      else process.env["LOCATION_EVENTS_TOPIC_ARN"] = prev;
    }
  });
});
