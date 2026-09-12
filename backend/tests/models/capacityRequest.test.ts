import { describe, expect, it } from "vitest";
import { AddCapacityRequestSchema, RemoveCapacityParamsSchema } from "../../models/capacityRequest";

describe("AddCapacityRequestSchema", () => {
  it("accepts a request with name and rate_per_hour", () => {
    expect(AddCapacityRequestSchema.parse({ name: "Truck 12", rate_per_hour: 50 })).toEqual({
      name: "Truck 12",
      rate_per_hour: 50,
    });
  });

  it("accepts a request with just name — rate_per_hour is optional", () => {
    expect(AddCapacityRequestSchema.parse({ name: "Truck 12" })).toEqual({ name: "Truck 12" });
  });

  it("rejects a missing name", () => {
    expect(AddCapacityRequestSchema.safeParse({}).success).toBe(false);
  });

  it("rejects an empty-string name", () => {
    expect(AddCapacityRequestSchema.safeParse({ name: "" }).success).toBe(false);
  });

  it("rejects a non-positive rate_per_hour", () => {
    expect(AddCapacityRequestSchema.safeParse({ name: "Truck 12", rate_per_hour: 0 }).success).toBe(false);
    expect(AddCapacityRequestSchema.safeParse({ name: "Truck 12", rate_per_hour: -1 }).success).toBe(false);
  });
});

describe("RemoveCapacityParamsSchema", () => {
  it("accepts a well-formed operator_id", () => {
    expect(RemoveCapacityParamsSchema.parse({ operator_id: "01OPERATOR" })).toEqual({ operator_id: "01OPERATOR" });
  });

  it("rejects a missing operator_id", () => {
    expect(RemoveCapacityParamsSchema.safeParse({}).success).toBe(false);
  });

  it("rejects an empty-string operator_id", () => {
    expect(RemoveCapacityParamsSchema.safeParse({ operator_id: "" }).success).toBe(false);
  });
});
