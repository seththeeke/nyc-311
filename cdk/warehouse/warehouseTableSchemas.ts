/*
 * The Glue column list per warehouse table (`7-data-warehousing.md` §7) —
 * the single source of truth for `Nyc311WarehouseCatalog` and the §4a/§6
 * drift test. Timestamp-ish fields are `string` on purpose: Firehose's
 * Parquet converter rejects ISO-8601 for a `timestamp` column, so the ISO
 * string is preserved and parsed in SQL (flagged deviation from §7).
 */

export interface WarehouseColumn {
  name: string;
  type: string;
}

export interface WarehouseTableSchema {
  /** Table name AND the S3 sub-prefix under `data/`. */
  tableName: string;
  /** The SNS topic ARN env-var key on the fan-out side (documentation only). */
  columns: WarehouseColumn[];
  /**
   * Top-level backend-model fields deliberately NOT surfaced as their own
   * column (opaque JSON blobs the transform Lambda re-serializes) — the
   * §4a drift test allowlist.
   */
  opaqueFields: string[];
}

/* Stamped onto every warehoused row by the transform Lambda. */
const INGEST_METADATA_COLUMNS: WarehouseColumn[] = [
  { name: "warehouse_ingested_at", type: "string" },
  { name: "ingestion_source", type: "string" },
];

export const WAREHOUSE_TABLE_SCHEMAS: WarehouseTableSchema[] = [
  {
    tableName: "order_events",
    opaqueFields: ["payload"],
    columns: [
      { name: "order_id", type: "string" },
      { name: "sequence_number", type: "bigint" },
      { name: "event_type", type: "string" },
      { name: "stage", type: "string" },
      { name: "occurred_at", type: "string" },
      { name: "actor", type: "string" },
      { name: "payload", type: "string" },
      ...INGEST_METADATA_COLUMNS,
    ],
  },
  {
    tableName: "order_snapshots",
    opaqueFields: ["retry_counts"],
    columns: [
      { name: "order_id", type: "string" },
      { name: "request_id", type: "string" },
      { name: "location_id", type: "string" },
      { name: "current_stage", type: "string" },
      { name: "status", type: "string" },
      { name: "priority_tier", type: "string" },
      { name: "sla_deadline", type: "string" },
      { name: "scheduled_start", type: "string" },
      { name: "scheduled_end", type: "string" },
      { name: "assigned_operator_id", type: "string" },
      { name: "reassignment_count", type: "bigint" },
      { name: "case_id", type: "string" },
      { name: "created_at", type: "string" },
      { name: "updated_at", type: "string" },
      { name: "last_event_sequence", type: "bigint" },
      { name: "retry_counts", type: "string" },
      ...INGEST_METADATA_COLUMNS,
    ],
  },
  {
    tableName: "requests",
    opaqueFields: ["raw_payload"],
    columns: [
      { name: "request_id", type: "string" },
      { name: "source", type: "string" },
      { name: "external_unique_key", type: "string" },
      { name: "location_id", type: "string" },
      { name: "complaint_type", type: "string" },
      { name: "descriptor", type: "string" },
      { name: "agency", type: "string" },
      { name: "status", type: "string" },
      { name: "created_by", type: "string" },
      { name: "created_at", type: "string" },
      { name: "raw_payload", type: "string" },
      ...INGEST_METADATA_COLUMNS,
    ],
  },
  {
    tableName: "locations",
    opaqueFields: [],
    columns: [
      { name: "location_id", type: "string" },
      { name: "bbl", type: "string" },
      { name: "address", type: "string" },
      { name: "borough", type: "string" },
      { name: "community_board", type: "string" },
      { name: "zip", type: "string" },
      { name: "latitude", type: "string" },
      { name: "longitude", type: "string" },
      { name: "created_at", type: "string" },
      ...INGEST_METADATA_COLUMNS,
    ],
  },
];
