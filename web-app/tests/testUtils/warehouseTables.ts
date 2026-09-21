import type { WarehouseTable } from "../../src/models/warehouseSchema";

function table(table_name: string, columnNames: string[]): WarehouseTable {
  return { table_name, columns: columnNames.map((name) => ({ name, type: name === "sequence_number" ? "bigint" : "string", comment: null })) };
}

/* The live catalog's six tables (cdk/warehouse/warehouseTableSchemas.ts), trimmed to the columns that matter. */
export const LIVE_TABLES: WarehouseTable[] = [
  table("order_events", ["order_id", "sequence_number", "event_type", "stage", "payload"]),
  table("order_snapshots", ["order_id", "request_id", "location_id", "status", "assigned_operator_id", "case_id", "created_at"]),
  table("requests", ["request_id", "source", "location_id", "complaint_type", "created_by"]),
  table("locations", ["location_id", "bbl", "address", "borough"]),
  table("operator_events", ["operator_id", "sequence_number", "event_type", "payload"]),
  table("operator_snapshots", ["operator_id", "name", "status", "rate_per_hour"]),
];
