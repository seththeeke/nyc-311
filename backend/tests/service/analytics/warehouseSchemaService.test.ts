import { GlueClient, GetTablesCommand } from "@aws-sdk/client-glue";
import { mockClient } from "aws-sdk-client-mock";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getWarehouseSchema } from "../../../service/analytics/warehouseSchemaService";

const glueMock = mockClient(GlueClient);
const glueClient = new GlueClient({});

beforeEach(() => {
  glueMock.reset();
  vi.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("getWarehouseSchema", () => {
  it("maps Glue tables to {table_name, columns[]} sorted by name, normalizing empty comments to null", async () => {
    glueMock.on(GetTablesCommand).resolves({
      TableList: [
        {
          Name: "requests",
          StorageDescriptor: { Columns: [{ Name: "request_id", Type: "string", Comment: "" }] },
        },
        {
          Name: "order_events",
          StorageDescriptor: {
            Columns: [
              { Name: "order_id", Type: "string" },
              { Name: "payload", Type: "string", Comment: "opaque" },
            ],
          },
        },
      ],
    });

    const result = await getWarehouseSchema({ glueClient, databaseName: "nyc311_warehouse_test" });

    expect(result.tables.map((t) => t.table_name)).toEqual(["order_events", "requests"]);
    expect(result.tables[0].columns).toEqual([
      { name: "order_id", type: "string", comment: null },
      { name: "payload", type: "string", comment: "opaque" },
    ]);
    expect(result.tables[1].columns[0].comment).toBeNull();
  });

  it("follows NextToken pagination", async () => {
    glueMock
      .on(GetTablesCommand)
      .resolvesOnce({ TableList: [{ Name: "a", StorageDescriptor: { Columns: [] } }], NextToken: "more" })
      .resolvesOnce({ TableList: [{ Name: "b", StorageDescriptor: { Columns: [] } }] });

    const result = await getWarehouseSchema({ glueClient, databaseName: "db" });

    expect(result.tables.map((t) => t.table_name)).toEqual(["a", "b"]);
    expect(glueMock.commandCalls(GetTablesCommand)).toHaveLength(2);
  });

  it("tolerates a page response that omits TableList entirely", async () => {
    glueMock.on(GetTablesCommand).resolves({});
    const result = await getWarehouseSchema({ glueClient, databaseName: "db" });
    expect(result.tables).toEqual([]);
  });

  it("throws when WAREHOUSE_DATABASE_NAME is unset and none is passed", async () => {
    const prev = process.env["WAREHOUSE_DATABASE_NAME"];
    delete process.env["WAREHOUSE_DATABASE_NAME"];
    try {
      await expect(getWarehouseSchema({ glueClient })).rejects.toThrow("WAREHOUSE_DATABASE_NAME");
    } finally {
      if (prev !== undefined) process.env["WAREHOUSE_DATABASE_NAME"] = prev;
    }
  });

  it("falls back to WAREHOUSE_DATABASE_NAME and a default GlueClient, tolerating sparse table metadata", async () => {
    const prev = process.env["WAREHOUSE_DATABASE_NAME"];
    process.env["WAREHOUSE_DATABASE_NAME"] = "nyc311_warehouse_test";
    glueMock.on(GetTablesCommand).resolves({
      TableList: [
        { StorageDescriptor: { Columns: [{}] } },
        { Name: "order_events" },
      ],
    } as never);
    try {
      const result = await getWarehouseSchema();

      expect(result.tables.map((t) => t.table_name)).toEqual(["", "order_events"]);
      expect(result.tables[0].columns).toEqual([{ name: "", type: "", comment: null }]);
      expect(result.tables[1].columns).toEqual([]);
      const sent = glueMock.commandCalls(GetTablesCommand)[0].args[0].input;
      expect(sent).toMatchObject({ DatabaseName: "nyc311_warehouse_test" });
    } finally {
      if (prev === undefined) delete process.env["WAREHOUSE_DATABASE_NAME"];
      else process.env["WAREHOUSE_DATABASE_NAME"] = prev;
    }
  });
});
