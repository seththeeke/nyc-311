import { describe, expect, it } from "vitest";
import { WarehouseJobSqlResponseSchema } from "../../src/models/warehouseJobSql";

describe("WarehouseJobSqlResponseSchema", () => {
  it("accepts a well-formed response", () => {
    expect(WarehouseJobSqlResponseSchema.parse({ sql: "SELECT 1" })).toEqual({ sql: "SELECT 1" });
  });

  it("rejects an empty sql string", () => {
    expect(WarehouseJobSqlResponseSchema.safeParse({ sql: "" }).success).toBe(false);
  });

  it("rejects a missing sql field", () => {
    expect(WarehouseJobSqlResponseSchema.safeParse({}).success).toBe(false);
  });
});
