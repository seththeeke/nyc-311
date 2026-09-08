import { logWarn } from "../../logger";

/*
 * Fields the warehouse Glue schema types as an opaque JSON `string`
 * (`7-data-warehousing.md` §4a/§7) — the fan-out publishes them as nested
 * JSON, so before Firehose's Parquet conversion (which maps them onto a
 * `string` column) they have to be re-serialized to a string.
 */
const OPAQUE_FIELDS = ["payload", "raw_payload", "retry_counts"] as const;

/**
 * Shapes one fanned-out record for the warehouse: re-serializes each
 * opaque field to a JSON string and stamps `warehouse_ingested_at` /
 * `ingestion_source`. Pure — takes the parsed record, returns the shaped
 * one; the controller owns base64 and the Firehose response envelope.
 */
export function transformWarehouseRecord(
  parsed: Record<string, unknown>,
  now: Date = new Date()
): Record<string, unknown> {
  const shaped: Record<string, unknown> = { ...parsed };

  for (const field of OPAQUE_FIELDS) {
    const value = shaped[field];
    if (value !== undefined && value !== null && typeof value === "object") {
      shaped[field] = JSON.stringify(value);
    }
  }

  /*
   * A live fan-out record carries neither field, so the stream stamps
   * both. A rebuild replay (§10) pre-sets them — `ingestion_source:
   * "REBUILD"` and `warehouse_ingested_at` pinned to the export time so
   * replayed rows sort correctly against live rows — and is respected.
   */
  shaped["warehouse_ingested_at"] =
    typeof parsed["warehouse_ingested_at"] === "string" ? parsed["warehouse_ingested_at"] : now.toISOString();
  shaped["ingestion_source"] =
    typeof parsed["ingestion_source"] === "string" ? parsed["ingestion_source"] : "STREAM";
  return shaped;
}

/**
 * Decodes one base64 Firehose record, transforms it, and returns the
 * newline-terminated base64 payload plus an `Ok`/`ProcessingFailed`
 * verdict. A record that isn't parseable JSON is failed (not dropped) so
 * it lands in the Firehose error prefix for inspection rather than
 * vanishing.
 */
export function transformFirehoseRecordData(
  base64Data: string,
  now: Date = new Date()
): { data: string; ok: boolean } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(base64Data, "base64").toString("utf8"));
  } catch (err) {
    logWarn("WarehouseRecordTransformParseFailed", { error: err instanceof Error ? err.message : err });
    return { data: base64Data, ok: false };
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    logWarn("WarehouseRecordTransformNotAnObject", {});
    return { data: base64Data, ok: false };
  }

  const shaped = transformWarehouseRecord(parsed as Record<string, unknown>, now);
  const out = Buffer.from(`${JSON.stringify(shaped)}\n`, "utf8").toString("base64");
  return { data: out, ok: true };
}
