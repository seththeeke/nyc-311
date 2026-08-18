import { describe, expect, it } from "vitest";
import { RequestStreamEventSchema, RequestStreamRecordSchema } from "../../models/requestStreamEvent";

function makeRecord(overrides: Record<string, unknown> = {}): unknown {
  return {
    eventName: "INSERT",
    dynamodb: {
      NewImage: { external_unique_key: { S: "12345" } },
      SequenceNumber: "111",
    },
    ...overrides,
  };
}

describe("RequestStreamRecordSchema", () => {
  it("accepts a well-formed INSERT record", () => {
    expect(RequestStreamRecordSchema.safeParse(makeRecord()).success).toBe(true);
  });

  it("accepts MODIFY and REMOVE eventNames", () => {
    expect(RequestStreamRecordSchema.safeParse(makeRecord({ eventName: "MODIFY" })).success).toBe(true);
    expect(RequestStreamRecordSchema.safeParse(makeRecord({ eventName: "REMOVE" })).success).toBe(true);
  });

  it("accepts a record with no NewImage (e.g. a REMOVE record)", () => {
    const record = { eventName: "REMOVE", dynamodb: { SequenceNumber: "111" } };
    expect(RequestStreamRecordSchema.safeParse(record).success).toBe(true);
  });

  it("rejects an unrecognized eventName", () => {
    expect(RequestStreamRecordSchema.safeParse(makeRecord({ eventName: "UPSERT" })).success).toBe(false);
  });

  it("rejects a record missing SequenceNumber", () => {
    const record = { eventName: "INSERT", dynamodb: { NewImage: {} } };
    expect(RequestStreamRecordSchema.safeParse(record).success).toBe(false);
  });

  it("rejects a record with an empty-string SequenceNumber", () => {
    const record = makeRecord({ dynamodb: { NewImage: {}, SequenceNumber: "" } });
    expect(RequestStreamRecordSchema.safeParse(record).success).toBe(false);
  });
});

describe("RequestStreamEventSchema", () => {
  it("accepts an event with multiple records", () => {
    const event = { Records: [makeRecord(), makeRecord({ eventName: "MODIFY" })] };
    expect(RequestStreamEventSchema.safeParse(event).success).toBe(true);
  });

  it("accepts an event with zero records", () => {
    expect(RequestStreamEventSchema.safeParse({ Records: [] }).success).toBe(true);
  });

  it("rejects a payload missing Records", () => {
    expect(RequestStreamEventSchema.safeParse({}).success).toBe(false);
  });

  it("rejects a non-object payload", () => {
    expect(RequestStreamEventSchema.safeParse("not-an-object").success).toBe(false);
    expect(RequestStreamEventSchema.safeParse(null).success).toBe(false);
  });
});
