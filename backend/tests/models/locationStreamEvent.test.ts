import { describe, expect, it } from "vitest";
import { LocationStreamEventSchema, LocationStreamRecordSchema } from "../../models/locationStreamEvent";

function record(overrides: Record<string, unknown> = {}): unknown {
  return {
    eventName: "INSERT",
    dynamodb: { NewImage: { location_id: { S: "1000000000" } }, SequenceNumber: "111" },
    ...overrides,
  };
}

describe("LocationStreamRecordSchema", () => {
  it("accepts a well-formed INSERT record", () => {
    expect(LocationStreamRecordSchema.safeParse(record()).success).toBe(true);
  });

  it("accepts MODIFY / REMOVE eventNames and a record with no NewImage", () => {
    expect(LocationStreamRecordSchema.safeParse(record({ eventName: "MODIFY" })).success).toBe(true);
    expect(LocationStreamRecordSchema.safeParse({ eventName: "REMOVE", dynamodb: { SequenceNumber: "1" } }).success).toBe(
      true
    );
  });

  it("rejects an unrecognized eventName / missing / empty SequenceNumber", () => {
    expect(LocationStreamRecordSchema.safeParse(record({ eventName: "UPSERT" })).success).toBe(false);
    expect(LocationStreamRecordSchema.safeParse({ eventName: "INSERT", dynamodb: { NewImage: {} } }).success).toBe(false);
    expect(LocationStreamRecordSchema.safeParse(record({ dynamodb: { NewImage: {}, SequenceNumber: "" } })).success).toBe(
      false
    );
  });
});

describe("LocationStreamEventSchema", () => {
  it("accepts events with many or zero records", () => {
    expect(LocationStreamEventSchema.safeParse({ Records: [record(), record()] }).success).toBe(true);
    expect(LocationStreamEventSchema.safeParse({ Records: [] }).success).toBe(true);
  });

  it("rejects a payload missing Records or a non-object", () => {
    expect(LocationStreamEventSchema.safeParse({}).success).toBe(false);
    expect(LocationStreamEventSchema.safeParse("nope").success).toBe(false);
  });
});
