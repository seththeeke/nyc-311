import { describe, expect, it } from "vitest";
import { WarehouseJobSchema, WarehouseJobManifestSchema } from "../../models/warehouseJob";

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

describe("WarehouseJobManifestSchema", () => {
  it("accepts a non-empty array of jobs", () => {
    const manifest = [
      { name: "job_a", sql: "SELECT 1" },
      { name: "job_b", sql: "SELECT 2" },
    ];
    expect(WarehouseJobManifestSchema.parse(manifest)).toEqual(manifest);
  });

  it("rejects an empty manifest", () => {
    expect(WarehouseJobManifestSchema.safeParse([]).success).toBe(false);
  });
});
