import { describe, expect, it } from "vitest";
import { WarehouseColumnSchema, WarehouseSchemaResponseSchema, WarehouseTableSchema } from "../../src/models/warehouseSchema";

const validColumn = { name: "order_id", type: "string", comment: null };

describe("WarehouseColumnSchema", () => {
  it("accepts a column with no comment", () => {
    expect(WarehouseColumnSchema.parse(validColumn)).toEqual(validColumn);
  });

  it("accepts a column with a comment", () => {
    const withComment = { ...validColumn, comment: "Opaque JSON." };
    expect(WarehouseColumnSchema.parse(withComment)).toEqual(withComment);
  });

  it("rejects an empty column name", () => {
    expect(WarehouseColumnSchema.safeParse({ ...validColumn, name: "" }).success).toBe(false);
  });
});

describe("WarehouseTableSchema", () => {
  it("accepts a table with columns", () => {
    const table = { table_name: "order_events", columns: [validColumn] };
    expect(WarehouseTableSchema.parse(table)).toEqual(table);
  });

  it("accepts a table with no columns", () => {
    const table = { table_name: "order_events", columns: [] };
    expect(WarehouseTableSchema.parse(table)).toEqual(table);
  });

  it("rejects a missing table_name", () => {
    expect(WarehouseTableSchema.safeParse({ columns: [] }).success).toBe(false);
  });
});

describe("WarehouseSchemaResponseSchema", () => {
  it("accepts a well-formed response", () => {
    const response = { tables: [{ table_name: "order_events", columns: [validColumn] }] };
    expect(WarehouseSchemaResponseSchema.parse(response)).toEqual(response);
  });

  it("accepts an empty catalog", () => {
    const response = { tables: [] };
    expect(WarehouseSchemaResponseSchema.parse(response)).toEqual(response);
  });

  it("rejects a response missing tables", () => {
    expect(WarehouseSchemaResponseSchema.safeParse({}).success).toBe(false);
  });
});
