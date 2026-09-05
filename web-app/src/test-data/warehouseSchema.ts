import type { WarehouseSchemaResponse } from "../models/warehouseSchema";

/*
 * Baked sample data for "mock" data mode (config.ts) — mirrors the three
 * Glue tables 7-data-warehousing.md §7 defines: stable typed columns plus
 * one opaque JSON-string column per table, plus the ingestion-bookkeeping
 * columns every warehoused row carries.
 */
export const MOCK_WAREHOUSE_SCHEMA: WarehouseSchemaResponse = {
  tables: [
    {
      table_name: "order_events",
      columns: [
        { name: "order_id", type: "string", comment: null },
        { name: "sequence_number", type: "bigint", comment: null },
        { name: "event_type", type: "string", comment: null },
        { name: "stage", type: "string", comment: null },
        { name: "occurred_at", type: "timestamp", comment: null },
        { name: "actor", type: "string", comment: null },
        { name: "payload", type: "string", comment: "Opaque JSON — parse with json_extract." },
        { name: "warehouse_ingested_at", type: "timestamp", comment: null },
        { name: "ingestion_source", type: "string", comment: "STREAM or REBUILD." },
      ],
    },
    {
      table_name: "order_snapshots",
      columns: [
        { name: "order_id", type: "string", comment: null },
        { name: "current_stage", type: "string", comment: null },
        { name: "status", type: "string", comment: null },
        { name: "priority_tier", type: "string", comment: null },
        { name: "sla_deadline", type: "timestamp", comment: null },
        { name: "scheduled_start", type: "timestamp", comment: null },
        { name: "scheduled_end", type: "timestamp", comment: null },
        { name: "assigned_operator_id", type: "string", comment: null },
        { name: "case_id", type: "string", comment: null },
        { name: "request_id", type: "string", comment: null },
        { name: "location_id", type: "string", comment: null },
        { name: "last_event_sequence", type: "bigint", comment: null },
        { name: "created_at", type: "timestamp", comment: null },
        { name: "updated_at", type: "timestamp", comment: null },
        { name: "retry_counts", type: "string", comment: "Opaque JSON map — parse with json_extract." },
        { name: "warehouse_ingested_at", type: "timestamp", comment: null },
        { name: "ingestion_source", type: "string", comment: "STREAM or REBUILD." },
        { name: "event_name", type: "string", comment: "INSERT or MODIFY; null for REBUILD rows." },
      ],
    },
    {
      table_name: "requests",
      columns: [
        { name: "request_id", type: "string", comment: null },
        { name: "source", type: "string", comment: null },
        { name: "external_unique_key", type: "string", comment: null },
        { name: "location_id", type: "string", comment: null },
        { name: "complaint_type", type: "string", comment: null },
        { name: "descriptor", type: "string", comment: null },
        { name: "agency", type: "string", comment: null },
        { name: "status", type: "string", comment: null },
        { name: "created_at", type: "timestamp", comment: null },
        { name: "raw_payload", type: "string", comment: "Opaque JSON — parse with json_extract." },
        { name: "warehouse_ingested_at", type: "timestamp", comment: null },
        { name: "ingestion_source", type: "string", comment: "STREAM or REBUILD." },
        { name: "event_name", type: "string", comment: "INSERT or MODIFY; null for REBUILD rows." },
      ],
    },
  ],
};
