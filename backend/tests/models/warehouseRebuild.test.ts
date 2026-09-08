import { describe, expect, it } from "vitest";
import {
  REBUILD_SOURCES,
  WarehouseRebuildTaskSchema,
  WarehouseRebuildResultSchema,
} from "../../models/warehouseRebuild";

describe("WarehouseRebuildTaskSchema", () => {
  const valid = { source: "orders", exportArn: "arn:…/export/01ID", exportTime: "2026-09-08T12:00:00.000Z" };

  it("accepts a well-formed task for each source", () => {
    for (const source of REBUILD_SOURCES) {
      expect(WarehouseRebuildTaskSchema.parse({ ...valid, source }).source).toBe(source);
    }
  });

  it("rejects an unknown source", () => {
    expect(WarehouseRebuildTaskSchema.safeParse({ ...valid, source: "shifts" }).success).toBe(false);
  });

  it("rejects an empty exportArn or exportTime", () => {
    expect(WarehouseRebuildTaskSchema.safeParse({ ...valid, exportArn: "" }).success).toBe(false);
    expect(WarehouseRebuildTaskSchema.safeParse({ ...valid, exportTime: "" }).success).toBe(false);
  });
});

describe("WarehouseRebuildResultSchema", () => {
  it("accepts a well-formed result", () => {
    const parsed = WarehouseRebuildResultSchema.parse({
      source: "orders",
      job_run_id: "01RUN",
      wiped_prefixes: ["data/order_snapshots/", "data/order_events/"],
      replayed_by_table: { order_snapshots: 3, order_events: 5 },
      total_replayed: 8,
    });
    expect(parsed.total_replayed).toBe(8);
  });

  it("rejects a negative replay count", () => {
    expect(
      WarehouseRebuildResultSchema.safeParse({
        source: "orders",
        job_run_id: "01RUN",
        wiped_prefixes: [],
        replayed_by_table: { order_events: -1 },
        total_replayed: 0,
      }).success
    ).toBe(false);
  });
});
