import { describe, expect, it } from "vitest";
import { OperatorSchema } from "../../models/operator";

describe("OperatorSchema", () => {
  it("accepts a valid operator_id", () => {
    expect(OperatorSchema.safeParse({ operator_id: "01OPERATOR" }).success).toBe(true);
  });

  it("rejects a missing operator_id", () => {
    expect(OperatorSchema.safeParse({}).success).toBe(false);
  });

  it("rejects an empty-string operator_id", () => {
    expect(OperatorSchema.safeParse({ operator_id: "" }).success).toBe(false);
  });
});
