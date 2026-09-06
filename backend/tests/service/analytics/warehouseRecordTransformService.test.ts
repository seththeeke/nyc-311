import { afterEach, describe, expect, it, vi } from "vitest";
import {
  transformFirehoseRecordData,
  transformWarehouseRecord,
} from "../../../service/analytics/warehouseRecordTransformService";

const NOW = new Date("2026-09-06T12:00:00.000Z");

afterEach(() => {
  vi.restoreAllMocks();
});

function b64(obj: unknown): string {
  return Buffer.from(JSON.stringify(obj), "utf8").toString("base64");
}

describe("transformWarehouseRecord", () => {
  it("stringifies each opaque object field and stamps warehouse metadata", () => {
    const out = transformWarehouseRecord(
      {
        order_id: "01ORDER",
        event_type: "ORDER_CREATED",
        payload: { request_id: "01REQ", location_id: "1000" },
      },
      NOW
    );

    expect(out).toEqual({
      order_id: "01ORDER",
      event_type: "ORDER_CREATED",
      payload: '{"request_id":"01REQ","location_id":"1000"}',
      warehouse_ingested_at: "2026-09-06T12:00:00.000Z",
      ingestion_source: "STREAM",
    });
  });

  it("stringifies retry_counts and raw_payload, leaves other object-free records alone", () => {
    const out = transformWarehouseRecord(
      { request_id: "01REQ", raw_payload: { bbl: "1" }, retry_counts: { INGEST: 0 } },
      NOW
    );

    expect(out.raw_payload).toBe('{"bbl":"1"}');
    expect(out.retry_counts).toBe('{"INGEST":0}');
  });

  it("leaves an opaque field that's already a string (or null/absent) untouched", () => {
    const out = transformWarehouseRecord({ order_id: "01ORDER", payload: null }, NOW);
    expect(out.payload).toBeNull();

    const out2 = transformWarehouseRecord({ order_id: "01ORDER", payload: "already-a-string" }, NOW);
    expect(out2.payload).toBe("already-a-string");
  });
});

describe("transformFirehoseRecordData", () => {
  it("decodes, transforms, and returns a newline-terminated base64 payload marked ok", () => {
    const { data, ok } = transformFirehoseRecordData(b64({ order_id: "01ORDER", payload: { a: 1 } }), NOW);

    expect(ok).toBe(true);
    const decoded = Buffer.from(data, "base64").toString("utf8");
    expect(decoded.endsWith("\n")).toBe(true);
    expect(JSON.parse(decoded)).toEqual({
      order_id: "01ORDER",
      payload: '{"a":1}',
      warehouse_ingested_at: "2026-09-06T12:00:00.000Z",
      ingestion_source: "STREAM",
    });
  });

  it("fails (not drops) a record whose data isn't valid JSON, keeping the original bytes", () => {
    const original = Buffer.from("not json", "utf8").toString("base64");
    vi.spyOn(console, "warn").mockImplementation(() => {});

    const { data, ok } = transformFirehoseRecordData(original, NOW);

    expect(ok).toBe(false);
    expect(data).toBe(original);
  });

  it("fails a record whose JSON is an array, a number, or null — not an object", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(transformFirehoseRecordData(b64([1, 2, 3]), NOW).ok).toBe(false);
    expect(transformFirehoseRecordData(b64(5), NOW).ok).toBe(false);
    expect(transformFirehoseRecordData(b64(null), NOW).ok).toBe(false);
  });
});
