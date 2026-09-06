import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Context } from "aws-lambda";
import { warehouseRecordTransformController } from "../../../controller/data-archival/warehouseRecordTransformController";
import { ValidationError } from "../../../models/errors";

const ctx = { awsRequestId: "req-1" } as Context;

function b64(obj: unknown): string {
  return Buffer.from(JSON.stringify(obj), "utf8").toString("base64");
}

beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("warehouseRecordTransformController", () => {
  it("transforms each record and returns one response entry per input, all Ok", async () => {
    const event = {
      records: [
        { recordId: "r1", data: b64({ order_id: "01A", payload: { x: 1 } }) },
        { recordId: "r2", data: b64({ request_id: "01B", raw_payload: { bbl: "1" } }) },
      ],
    };

    const response = await warehouseRecordTransformController(event, ctx);

    expect(response.records).toHaveLength(2);
    expect(response.records.map((r) => r.result)).toEqual(["Ok", "Ok"]);
    const first = JSON.parse(Buffer.from(response.records[0].data, "base64").toString("utf8"));
    expect(first.payload).toBe('{"x":1}');
    expect(first.ingestion_source).toBe("STREAM");
  });

  it("marks an unparseable record ProcessingFailed while still processing the rest", async () => {
    const event = {
      records: [
        { recordId: "r1", data: Buffer.from("garbage", "utf8").toString("base64") },
        { recordId: "r2", data: b64({ order_id: "01A" }) },
      ],
    };

    const response = await warehouseRecordTransformController(event, ctx);

    expect(response.records.map((r) => r.result)).toEqual(["ProcessingFailed", "Ok"]);
  });

  it("returns an empty records array for an empty batch", async () => {
    const response = await warehouseRecordTransformController({ records: [] }, ctx);
    expect(response.records).toEqual([]);
  });

  it("throws ValidationError on a malformed event", async () => {
    await expect(warehouseRecordTransformController({ notRecords: [] }, ctx)).rejects.toBeInstanceOf(ValidationError);
    await expect(warehouseRecordTransformController("nope", ctx)).rejects.toBeInstanceOf(ValidationError);
  });
});
