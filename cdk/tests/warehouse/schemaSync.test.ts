import { readFileSync } from "node:fs";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { WAREHOUSE_TABLE_SCHEMAS } from "../../warehouse/warehouseTableSchemas";

/*
 * 7-data-warehousing.md §4a/§6 — the drift-detection gate. Every top-level
 * field on the backend zod model a warehouse table is built from must be a
 * Glue column or on that table's `opaqueFields` allowlist; a field that's
 * neither fails here, named. Reads the model SOURCE via a lightweight text
 * extraction of the `z.object({ ... })` field list — `cdk/` has no `zod`
 * dep and can't resolve `backend/models/*.ts`'s imports to load them.
 */

const BACKEND_MODELS = path.join(__dirname, "..", "..", "..", "backend", "models");

/** Table name -> the backend model file + exported `z.object` schema it's built from. */
const TABLE_TO_MODEL: Record<string, { file: string; schema: string }> = {
  order_events: { file: "order.ts", schema: "OrderEventSchema" },
  order_snapshots: { file: "order.ts", schema: "OrderSchema" },
  requests: { file: "request.ts", schema: "RequestSchema" },
  locations: { file: "location.ts", schema: "LocationSchema" },
};

function extractZodObjectFields(source: string, schemaName: string): string[] {
  const start = source.indexOf(`export const ${schemaName} = z.object({`);
  if (start === -1) throw new Error(`Could not find "export const ${schemaName} = z.object({" in source`);
  const bodyStart = source.indexOf("{", start) + 1;

  let depth = 1;
  let i = bodyStart;
  for (; i < source.length && depth > 0; i += 1) {
    if (source[i] === "{") depth += 1;
    else if (source[i] === "}") depth -= 1;
  }
  const body = source.slice(bodyStart, i - 1);

  const fields: string[] = [];
  for (const line of body.split("\n")) {
    const match = /^\s{2}([a-z_][a-z0-9_]*):\s*z\./i.exec(line);
    if (match) fields.push(match[1]);
  }
  return fields;
}

describe("warehouse schema sync (7-data-warehousing.md §4a)", () => {
  for (const tableSchema of WAREHOUSE_TABLE_SCHEMAS) {
    const model = TABLE_TO_MODEL[tableSchema.tableName];
    if (!model) continue;

    it(`${tableSchema.tableName}: every ${model.schema} field is a Glue column or an allowlisted opaque field`, () => {
      const source = readFileSync(path.join(BACKEND_MODELS, model.file), "utf8");
      const modelFields = extractZodObjectFields(source, model.schema);
      expect(modelFields.length).toBeGreaterThan(0);

      const columnNames = new Set(tableSchema.columns.map((c) => c.name));
      const opaque = new Set(tableSchema.opaqueFields);

      const missing = modelFields.filter((f) => !columnNames.has(f) && !opaque.has(f));
      expect(
        missing,
        `${model.schema} has field(s) [${missing.join(", ")}] with no ${tableSchema.tableName} Glue column and ` +
          `not on opaqueFields — add a column to warehouseTableSchemas.ts or allowlist it as opaque.`
      ).toEqual([]);
    });

    it(`${tableSchema.tableName}: every allowlisted opaque field really exists on ${model.schema}`, () => {
      const source = readFileSync(path.join(BACKEND_MODELS, model.file), "utf8");
      const modelFields = new Set(extractZodObjectFields(source, model.schema));
      for (const opaque of tableSchema.opaqueFields) {
        expect(modelFields.has(opaque), `opaqueFields lists "${opaque}" but ${model.schema} has no such field`).toBe(
          true
        );
      }
    });
  }

  it("names every table exactly once", () => {
    const names = WAREHOUSE_TABLE_SCHEMAS.map((s) => s.tableName);
    expect(new Set(names).size).toBe(names.length);
    expect(names).toEqual(["order_events", "order_snapshots", "requests", "locations"]);
  });
});
