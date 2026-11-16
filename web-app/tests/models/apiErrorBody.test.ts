import { describe, expect, it } from "vitest";
import { ApiErrorBodySchema } from "../../src/models/apiErrorBody";

describe("ApiErrorBodySchema", () => {
  it("accepts a body with a string message and keeps only it", () => {
    expect(ApiErrorBodySchema.parse({ message: "Conflict", code: "X" })).toEqual({ message: "Conflict" });
  });

  it("rejects a non-string message", () => {
    expect(ApiErrorBodySchema.safeParse({ message: 409 }).success).toBe(false);
  });

  it("rejects a missing message", () => {
    expect(ApiErrorBodySchema.safeParse({}).success).toBe(false);
  });
});
