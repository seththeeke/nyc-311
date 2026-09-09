import { describe, expect, it } from "vitest";
import {
  WarehouseRebuildTaskSchema,
  RebuildWipeResultSchema,
  RebuildReplayResultSchema,
  WarehouseRebuildResultSchema,
} from "../../models/warehouseRebuild";

const T = "2026-09-08T12:00:00.000Z";
const ARN = "arn:aws:dynamodb:us-east-1:111:table/Orders-Test/export/01ID";
const CHUNK = { fileKey: "f1", start: 0, count: 3000 };

describe("WarehouseRebuildTaskSchema (discriminated on phase)", () => {
  it("accepts each phase's shape", () => {
    expect(WarehouseRebuildTaskSchema.parse({ phase: "wipe", source: "orders", exportArn: ARN, startedAt: T }).phase).toBe("wipe");
    expect(WarehouseRebuildTaskSchema.parse({ phase: "replay", source: "orders", chunk: CHUNK, exportTime: T }).phase).toBe("replay");
    expect(
      WarehouseRebuildTaskSchema.parse({
        phase: "finalize",
        source: "orders",
        exportArn: ARN,
        jobRunId: "01RUN",
        startedAt: T,
        replayResults: [{ order_events: 3 }],
      }).phase
    ).toBe("finalize");
    expect(
      WarehouseRebuildTaskSchema.parse({ phase: "fail", source: "requests", exportArn: ARN, startedAt: T }).phase
    ).toBe("fail");
  });

  it("allows the fail phase to omit jobRunId and error (wipe failed before a run existed)", () => {
    const parsed = WarehouseRebuildTaskSchema.parse({ phase: "fail", source: "locations", exportArn: ARN, startedAt: T });
    expect(parsed).toMatchObject({ phase: "fail", source: "locations" });
  });

  it("rejects an unknown phase and an unknown source", () => {
    expect(WarehouseRebuildTaskSchema.safeParse({ phase: "sideways", source: "orders" }).success).toBe(false);
    expect(WarehouseRebuildTaskSchema.safeParse({ phase: "wipe", source: "shifts", exportArn: ARN, startedAt: T }).success).toBe(false);
  });

  it("rejects a replay chunk with a non-positive count or negative start", () => {
    expect(WarehouseRebuildTaskSchema.safeParse({ phase: "replay", source: "orders", chunk: { fileKey: "f", start: 0, count: 0 }, exportTime: T }).success).toBe(false);
    expect(WarehouseRebuildTaskSchema.safeParse({ phase: "replay", source: "orders", chunk: { fileKey: "f", start: -1, count: 5 }, exportTime: T }).success).toBe(false);
  });
});

describe("result schemas", () => {
  it("RebuildWipeResultSchema needs at least one chunk", () => {
    expect(RebuildWipeResultSchema.safeParse({ job_run_id: "01RUN", chunks: [] }).success).toBe(false);
    expect(RebuildWipeResultSchema.parse({ job_run_id: "01RUN", chunks: [CHUNK] }).chunks).toHaveLength(1);
  });

  it("RebuildReplayResultSchema is a table->count map, non-negative", () => {
    expect(RebuildReplayResultSchema.parse({ order_events: 0, order_snapshots: 5 }).order_snapshots).toBe(5);
    expect(RebuildReplayResultSchema.safeParse({ order_events: -1 }).success).toBe(false);
  });

  it("WarehouseRebuildResultSchema", () => {
    const parsed = WarehouseRebuildResultSchema.parse({
      source: "orders",
      job_run_id: "01RUN",
      replayed_by_table: { order_events: 900000, order_snapshots: 50000 },
      total_replayed: 950000,
    });
    expect(parsed.total_replayed).toBe(950000);
  });
});
