import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";
import { mockClient } from "aws-sdk-client-mock";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { fanOutOperatorRecord } from "../../../service/ingestion/operatorEventService";
import type { OperatorStreamRecord } from "../../../models/operatorStreamEvent";

const TOPIC_ARN = "arn:aws:sns:us-east-1:123456789012:Nyc311OperatorEvents-Test";
const PROJECTIONS_TOPIC_ARN = "arn:aws:sns:us-east-1:123456789012:Nyc311OperatorProjections-Test";
const snsMock = mockClient(SNSClient);
const snsClient = new SNSClient({});

function makeStreamRecord(overrides: Partial<OperatorStreamRecord> = {}): OperatorStreamRecord {
  return {
    eventName: "INSERT",
    dynamodb: {
      NewImage: {
        operator_id: { S: "01OPERATOR" },
        sk: { S: "EVENT#0" },
        event_type: { S: "OPERATOR_ADDED" },
      },
      SequenceNumber: "111",
    },
    ...overrides,
  };
}

function metadataRecord(overrides: Partial<OperatorStreamRecord> = {}): OperatorStreamRecord {
  return {
    eventName: "MODIFY",
    dynamodb: {
      NewImage: {
        operator_id: { S: "01OPERATOR" },
        sk: { S: "#METADATA" },
        status: { S: "ACTIVE" },
        current_activity: { S: "IDLE" },
      },
      SequenceNumber: "222",
    },
    ...overrides,
  };
}

const FAN_OUT_DEPS = { snsClient, eventsTopicArn: TOPIC_ARN, projectionsTopicArn: PROJECTIONS_TOPIC_ARN };

beforeEach(() => {
  snsMock.reset();
});

afterEach(() => {
  snsMock.reset();
});

describe("fanOutOperatorRecord", () => {
  it("publishes an EVENT# item to the events topic, tagged with its event_type message attribute", async () => {
    snsMock.on(PublishCommand).resolves({});

    await fanOutOperatorRecord(makeStreamRecord(), FAN_OUT_DEPS);

    const calls = snsMock.commandCalls(PublishCommand);
    expect(calls).toHaveLength(1);
    const input = calls[0]?.args[0].input;
    expect(input?.TopicArn).toBe(TOPIC_ARN);
    expect(JSON.parse(input?.Message as string)).toEqual({
      operator_id: "01OPERATOR",
      sk: "EVENT#0",
      event_type: "OPERATOR_ADDED",
    });
    expect(input?.MessageAttributes).toEqual({
      event_type: { DataType: "String", StringValue: "OPERATOR_ADDED" },
    });
  });

  it("publishes a MODIFY of #METADATA to the projections topic, tagged with its event_name", async () => {
    snsMock.on(PublishCommand).resolves({});

    await fanOutOperatorRecord(metadataRecord(), FAN_OUT_DEPS);

    const calls = snsMock.commandCalls(PublishCommand);
    expect(calls).toHaveLength(1);
    const input = calls[0]?.args[0].input;
    expect(input?.TopicArn).toBe(PROJECTIONS_TOPIC_ARN);
    expect(JSON.parse(input?.Message as string)).toEqual({
      operator_id: "01OPERATOR",
      sk: "#METADATA",
      status: "ACTIVE",
      current_activity: "IDLE",
    });
    expect(input?.MessageAttributes).toEqual({
      event_name: { DataType: "String", StringValue: "MODIFY" },
    });
  });

  it("publishes an INSERT of #METADATA (operator added) to the projections topic", async () => {
    snsMock.on(PublishCommand).resolves({});

    await fanOutOperatorRecord(metadataRecord({ eventName: "INSERT" }), FAN_OUT_DEPS);

    const input = snsMock.commandCalls(PublishCommand)[0]?.args[0].input;
    expect(input?.TopicArn).toBe(PROJECTIONS_TOPIC_ARN);
    expect(input?.MessageAttributes).toEqual({
      event_name: { DataType: "String", StringValue: "INSERT" },
    });
  });

  it("skips a MODIFY of an EVENT# item (never happens — events are immutable) without publishing", async () => {
    await fanOutOperatorRecord(makeStreamRecord({ eventName: "MODIFY" }), FAN_OUT_DEPS);

    expect(snsMock.calls()).toHaveLength(0);
  });

  it("skips a REMOVE record without publishing anything", async () => {
    await fanOutOperatorRecord(metadataRecord({ eventName: "REMOVE" }), FAN_OUT_DEPS);

    expect(snsMock.calls()).toHaveLength(0);
  });

  it("skips an INSERT record with no NewImage at all (e.g. KEYS_ONLY delivery)", async () => {
    await fanOutOperatorRecord({ eventName: "INSERT", dynamodb: { SequenceNumber: "111" } }, FAN_OUT_DEPS);

    expect(snsMock.calls()).toHaveLength(0);
  });

  it("skips an INSERT record whose NewImage has no sk attribute at all", async () => {
    const record = makeStreamRecord({
      dynamodb: { NewImage: { operator_id: { S: "01OPERATOR" } }, SequenceNumber: "333" },
    });

    await fanOutOperatorRecord(record, FAN_OUT_DEPS);

    expect(snsMock.calls()).toHaveLength(0);
  });

  it("skips an INSERT record whose sk attribute isn't a string (S) AttributeValue", async () => {
    const record = makeStreamRecord({
      dynamodb: { NewImage: { operator_id: { S: "01OPERATOR" }, sk: { N: "1" } }, SequenceNumber: "444" },
    });

    await fanOutOperatorRecord(record, FAN_OUT_DEPS);

    expect(snsMock.calls()).toHaveLength(0);
  });

  it("tags a missing/non-string event_type as UNKNOWN rather than throwing", async () => {
    snsMock.on(PublishCommand).resolves({});
    const record = makeStreamRecord({
      dynamodb: {
        NewImage: { operator_id: { S: "01OPERATOR" }, sk: { S: "EVENT#0" } },
        SequenceNumber: "555",
      },
    });

    await fanOutOperatorRecord(record, FAN_OUT_DEPS);

    const input = snsMock.commandCalls(PublishCommand)[0]?.args[0].input;
    expect(input?.MessageAttributes).toEqual({
      event_type: { DataType: "String", StringValue: "UNKNOWN" },
    });
  });

  it("lets an SNS Publish failure propagate", async () => {
    snsMock.on(PublishCommand).rejects(new Error("SNS unavailable"));

    await expect(fanOutOperatorRecord(makeStreamRecord(), FAN_OUT_DEPS)).rejects.toThrow("SNS unavailable");
  });

  it("throws when eventsTopicArn isn't provided and OPERATOR_EVENTS_TOPIC_ARN isn't set", async () => {
    const previous = process.env["OPERATOR_EVENTS_TOPIC_ARN"];
    delete process.env["OPERATOR_EVENTS_TOPIC_ARN"];

    try {
      await expect(fanOutOperatorRecord(makeStreamRecord(), { snsClient })).rejects.toThrow(
        "Missing required environment variable: OPERATOR_EVENTS_TOPIC_ARN"
      );
    } finally {
      if (previous !== undefined) process.env["OPERATOR_EVENTS_TOPIC_ARN"] = previous;
    }
  });

  it("throws when projectionsTopicArn isn't provided and OPERATOR_PROJECTIONS_TOPIC_ARN isn't set", async () => {
    const previous = process.env["OPERATOR_PROJECTIONS_TOPIC_ARN"];
    delete process.env["OPERATOR_PROJECTIONS_TOPIC_ARN"];

    try {
      await expect(fanOutOperatorRecord(metadataRecord(), { snsClient })).rejects.toThrow(
        "Missing required environment variable: OPERATOR_PROJECTIONS_TOPIC_ARN"
      );
    } finally {
      if (previous !== undefined) process.env["OPERATOR_PROJECTIONS_TOPIC_ARN"] = previous;
    }
  });

  it("falls back to the env-var topic ARNs and a fresh SNSClient when deps are omitted", async () => {
    const prevEvents = process.env["OPERATOR_EVENTS_TOPIC_ARN"];
    const prevProjections = process.env["OPERATOR_PROJECTIONS_TOPIC_ARN"];
    process.env["OPERATOR_EVENTS_TOPIC_ARN"] = TOPIC_ARN;
    process.env["OPERATOR_PROJECTIONS_TOPIC_ARN"] = PROJECTIONS_TOPIC_ARN;
    snsMock.on(PublishCommand).resolves({});

    try {
      await fanOutOperatorRecord(makeStreamRecord());
      await fanOutOperatorRecord(metadataRecord());

      const calls = snsMock.commandCalls(PublishCommand);
      expect(calls).toHaveLength(2);
      expect(calls[0]?.args[0].input.TopicArn).toBe(TOPIC_ARN);
      expect(calls[1]?.args[0].input.TopicArn).toBe(PROJECTIONS_TOPIC_ARN);
    } finally {
      if (prevEvents === undefined) delete process.env["OPERATOR_EVENTS_TOPIC_ARN"];
      else process.env["OPERATOR_EVENTS_TOPIC_ARN"] = prevEvents;
      if (prevProjections === undefined) delete process.env["OPERATOR_PROJECTIONS_TOPIC_ARN"];
      else process.env["OPERATOR_PROJECTIONS_TOPIC_ARN"] = prevProjections;
    }
  });

  it("skips a record whose event_name/eventName combination matches neither EVENT# nor #METADATA shape, logging a skip", async () => {
    const record = makeStreamRecord({
      dynamodb: { NewImage: { operator_id: { S: "01OPERATOR" }, sk: { S: "SOMETHING#ELSE" } }, SequenceNumber: "666" },
    });

    await fanOutOperatorRecord(record, FAN_OUT_DEPS);

    expect(snsMock.calls()).toHaveLength(0);
  });
});
