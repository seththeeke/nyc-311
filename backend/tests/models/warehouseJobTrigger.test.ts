import { describe, expect, it } from "vitest";
import { WarehouseJobTriggerSchema } from "../../models/warehouseJobTrigger";

describe("WarehouseJobTriggerSchema", () => {
  it("accepts an empty object (the Scheduler's default configured Input)", () => {
    expect(WarehouseJobTriggerSchema.safeParse({}).success).toBe(true);
  });

  it("accepts an object with arbitrary keys", () => {
    expect(WarehouseJobTriggerSchema.safeParse({ note: "manual retry queue" }).success).toBe(true);
  });

  it("rejects a non-object payload", () => {
    expect(WarehouseJobTriggerSchema.safeParse("not-an-object").success).toBe(false);
    expect(WarehouseJobTriggerSchema.safeParse(null).success).toBe(false);
    expect(WarehouseJobTriggerSchema.safeParse(42).success).toBe(false);
  });
});
