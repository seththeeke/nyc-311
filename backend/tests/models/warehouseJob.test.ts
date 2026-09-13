import { describe, expect, it } from "vitest";
import { WarehouseJobSchema } from "../../models/warehouseJob";

describe("WarehouseJobSchema", () => {
  it("accepts a lower_snake_case name with SQL", () => {
    const job = { name: "order_volume_by_stage_7d", sql: "SELECT 1" };
    expect(WarehouseJobSchema.parse(job)).toEqual(job);
  });

  it("rejects a name that isn't S3-partition-safe", () => {
    for (const name of ["Order-Volume", "order volume", "OrderVolume", ""]) {
      expect(WarehouseJobSchema.safeParse({ name, sql: "SELECT 1" }).success).toBe(false);
    }
  });

  it("rejects an empty SQL string", () => {
    expect(WarehouseJobSchema.safeParse({ name: "job_a", sql: "" }).success).toBe(false);
  });
});
