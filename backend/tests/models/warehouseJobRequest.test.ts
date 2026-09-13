import { describe, expect, it } from "vitest";
import { CreateWarehouseJobRequestSchema, DeleteWarehouseJobParamsSchema } from "../../models/warehouseJobRequest";

describe("CreateWarehouseJobRequestSchema", () => {
  const valid = { name: "order_volume_by_zip", cadence_cron: "cron(0 9 * * ? *)", sql: "SELECT 1" };

  it("accepts a well-formed request", () => {
    expect(CreateWarehouseJobRequestSchema.parse(valid)).toEqual(valid);
  });

  it("rejects a name that isn't lower_snake_case", () => {
    for (const name of ["Order-Zip", "order zip", ""]) {
      expect(CreateWarehouseJobRequestSchema.safeParse({ ...valid, name }).success).toBe(false);
    }
  });

  it("rejects an empty cadence_cron or sql", () => {
    expect(CreateWarehouseJobRequestSchema.safeParse({ ...valid, cadence_cron: "" }).success).toBe(false);
    expect(CreateWarehouseJobRequestSchema.safeParse({ ...valid, sql: "" }).success).toBe(false);
  });
});

describe("DeleteWarehouseJobParamsSchema", () => {
  it("accepts a name", () => {
    expect(DeleteWarehouseJobParamsSchema.parse({ name: "order_volume_by_zip" })).toEqual({
      name: "order_volume_by_zip",
    });
  });

  it("rejects a missing name", () => {
    expect(DeleteWarehouseJobParamsSchema.safeParse({}).success).toBe(false);
  });
});
