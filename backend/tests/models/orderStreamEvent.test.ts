import { describe, expect, it } from "vitest";
import { OrderStreamEventSchema, OrderStreamRecordSchema } from "../../models/orderStreamEvent";

function makeRecord(overrides: Record<string, unknown> = {}): unknown {
  return {
    eventName: "INSERT",
    dynamodb: {
      NewImage: { sk: { S: "EVENT#0" } },
      SequenceNumber: "111",
    },
    ...overrides,
  };
}

describe("OrderStreamRecordSchema", () => {
  it("accepts a well-formed INSERT record", () => {
    expect(OrderStreamRecordSchema.safeParse(makeRecord()).success).toBe(true);
  });

  it("accepts MODIFY and REMOVE eventNames", () => {
    expect(OrderStreamRecordSchema.safeParse(makeRecord({ eventName: "MODIFY" })).success).toBe(true);
    expect(OrderStreamRecordSchema.safeParse(makeRecord({ eventName: "REMOVE" })).success).toBe(true);
  });

  it("accepts a record with no NewImage (e.g. a REMOVE record)", () => {
    const record = { eventName: "REMOVE", dynamodb: { SequenceNumber: "111" } };
    expect(OrderStreamRecordSchema.safeParse(record).success).toBe(true);
  });

  it("rejects an unrecognized eventName", () => {
    expect(OrderStreamRecordSchema.safeParse(makeRecord({ eventName: "UPSERT" })).success).toBe(false);
  });

  it("rejects a record missing SequenceNumber", () => {
    const record = { eventName: "INSERT", dynamodb: { NewImage: {} } };
    expect(OrderStreamRecordSchema.safeParse(record).success).toBe(false);
  });

  it("rejects a record with an empty-string SequenceNumber", () => {
    const record = makeRecord({ dynamodb: { NewImage: {}, SequenceNumber: "" } });
    expect(OrderStreamRecordSchema.safeParse(record).success).toBe(false);
  });
});

describe("OrderStreamEventSchema", () => {
  it("accepts an event with multiple records", () => {
    const event = { Records: [makeRecord(), makeRecord({ eventName: "MODIFY" })] };
    expect(OrderStreamEventSchema.safeParse(event).success).toBe(true);
  });

  it("accepts an event with zero records", () => {
    expect(OrderStreamEventSchema.safeParse({ Records: [] }).success).toBe(true);
  });

  it("rejects a payload missing Records", () => {
    expect(OrderStreamEventSchema.safeParse({}).success).toBe(false);
  });

  it("rejects a non-object payload", () => {
    expect(OrderStreamEventSchema.safeParse("not-an-object").success).toBe(false);
    expect(OrderStreamEventSchema.safeParse(null).success).toBe(false);
  });
});
