import { GlueClient, GetTablesCommand, type Table } from "@aws-sdk/client-glue";
import { logInfo } from "../../logger";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

export interface WarehouseColumn {
  name: string;
  type: string;
  comment: string | null;
}

export interface WarehouseTable {
  table_name: string;
  columns: WarehouseColumn[];
}

export interface WarehouseSchemaResponse {
  tables: WarehouseTable[];
}

export interface WarehouseSchemaDeps {
  glueClient?: GlueClient;
  databaseName?: string;
}

/**
 * Reads the live Glue Data Catalog for the warehouse database and returns
 * each table's column list exactly as Glue has it (`7-data-warehousing.md`
 * §12) — not a checked-in copy, so a schema change surfaces on `/data`
 * with no code change here.
 */
export async function getWarehouseSchema(deps: WarehouseSchemaDeps = {}): Promise<WarehouseSchemaResponse> {
  const glueClient = deps.glueClient ?? new GlueClient({});
  const databaseName = deps.databaseName ?? requireEnv("WAREHOUSE_DATABASE_NAME");

  logInfo("GetWarehouseSchemaStarted", { databaseName });

  const tables: Table[] = [];
  let nextToken: string | undefined;
  do {
    const page = await glueClient.send(new GetTablesCommand({ DatabaseName: databaseName, NextToken: nextToken }));
    tables.push(...(page.TableList ?? []));
    nextToken = page.NextToken;
  } while (nextToken);

  const response: WarehouseSchemaResponse = {
    tables: tables
      .map((table) => ({
        table_name: table.Name ?? "",
        columns: (table.StorageDescriptor?.Columns ?? []).map((col) => ({
          name: col.Name ?? "",
          type: col.Type ?? "",
          comment: col.Comment && col.Comment.length > 0 ? col.Comment : null,
        })),
      }))
      .sort((a, b) => a.table_name.localeCompare(b.table_name)),
  };

  logInfo("GetWarehouseSchemaCompleted", { tableCount: response.tables.length });
  return response;
}
