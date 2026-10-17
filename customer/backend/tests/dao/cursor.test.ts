import { describe, expect, it } from "vitest";
import { decodeCursor, encodeCursor } from "../../dao/cursor";
import { ValidationError } from "../../models/errors";

describe("page cursors", () => {
  it("round-trips a DynamoDB key and has no cursor for the last page", () => {
    const key = { persona_id: "hawthorn", sk: "IDEA#01X" };
    expect(decodeCursor(encodeCursor(key) ?? undefined)).toEqual(key);
    expect(encodeCursor(undefined)).toBeNull();
    expect(decodeCursor(undefined)).toBeUndefined();
  });

  it("rejects anything this API did not issue", () => {
    const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
    for (const bad of ["not base64 json", encode([1]), encode(null), encode({}), encode({ persona_id: 3 })]) {
      expect(() => decodeCursor(bad)).toThrow(ValidationError);
    }
  });
});
