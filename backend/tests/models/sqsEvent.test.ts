import { describe, expect, it } from "vitest";
import { SqsEventSchema, SqsRecordSchema } from "../../models/sqsEvent";

describe("SqsRecordSchema", () => {
  it("accepts a well-formed record", () => {
    expect(SqsRecordSchema.safeParse({ messageId: "1", body: "{}" }).success).toBe(true);
  });

  it("accepts an empty-string body", () => {
    expect(SqsRecordSchema.safeParse({ messageId: "1", body: "" }).success).toBe(true);
  });

  it("rejects a missing messageId", () => {
    expect(SqsRecordSchema.safeParse({ body: "{}" }).success).toBe(false);
  });

  it("rejects an empty-string messageId", () => {
    expect(SqsRecordSchema.safeParse({ messageId: "", body: "{}" }).success).toBe(false);
  });
});

describe("SqsEventSchema", () => {
  it("accepts an event with multiple records", () => {
    const event = { Records: [{ messageId: "1", body: "{}" }, { messageId: "2", body: "{}" }] };
    expect(SqsEventSchema.safeParse(event).success).toBe(true);
  });

  it("accepts an event with zero records", () => {
    expect(SqsEventSchema.safeParse({ Records: [] }).success).toBe(true);
  });

  it("rejects a payload missing Records", () => {
    expect(SqsEventSchema.safeParse({}).success).toBe(false);
  });

  it("rejects a non-object payload", () => {
    expect(SqsEventSchema.safeParse("not-an-object").success).toBe(false);
  });
});
