import { describe, expect, it } from "vitest";
import { WarehouseJobTriggerSchema } from "../../models/warehouseJobTrigger";

describe("WarehouseJobTriggerSchema", () => {
  it("accepts a well-formed trigger with job_name", () => {
    expect(WarehouseJobTriggerSchema.parse({ job_name: "order_volume_by_stage_7d" })).toEqual({
      job_name: "order_volume_by_stage_7d",
    });
  });

  it("rejects an empty object (Leg 8 — every invocation is scoped to one job)", () => {
    expect(WarehouseJobTriggerSchema.safeParse({}).success).toBe(false);
  });

  it("rejects an empty job_name", () => {
    expect(WarehouseJobTriggerSchema.safeParse({ job_name: "" }).success).toBe(false);
  });

  it("rejects a non-object payload", () => {
    expect(WarehouseJobTriggerSchema.safeParse("not-an-object").success).toBe(false);
    expect(WarehouseJobTriggerSchema.safeParse(null).success).toBe(false);
    expect(WarehouseJobTriggerSchema.safeParse(42).success).toBe(false);
  });
});
