import type { Context } from "aws-lambda";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { rebuildSource } from "../../../service/analytics/warehouseRebuildService";
import { warehouseRebuildController } from "../../../controller/data-archival/warehouseRebuildController";
import { ValidationError } from "../../../models/errors";
import type { WarehouseRebuildResult } from "../../../models/warehouseRebuild";

vi.mock("../../../service/analytics/warehouseRebuildService", () => ({ rebuildSource: vi.fn() }));
const mocked = vi.mocked(rebuildSource);

const CONTEXT = { awsRequestId: "req-1" } as Context;
const TASK = { source: "orders", exportArn: "arn:…/export/01ID", exportTime: "2026-09-08T12:00:00.000Z" };
const RESULT: WarehouseRebuildResult = {
  source: "orders",
  job_run_id: "01RUN",
  wiped_prefixes: ["data/order_snapshots/", "data/order_events/"],
  replayed_by_table: { order_snapshots: 1, order_events: 2 },
  total_replayed: 3,
};

beforeEach(() => {
  mocked.mockReset();
  vi.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("warehouseRebuildController", () => {
  it("validates the task and returns the service result", async () => {
    mocked.mockResolvedValue(RESULT);
    await expect(warehouseRebuildController(TASK, CONTEXT)).resolves.toEqual(RESULT);
    expect(mocked).toHaveBeenCalledWith(TASK);
  });

  it("throws a ValidationError on a malformed task, without calling the service", async () => {
    await expect(warehouseRebuildController({ source: "nope" }, CONTEXT)).rejects.toBeInstanceOf(ValidationError);
    expect(mocked).not.toHaveBeenCalled();
  });

  it("lets a service error propagate so the Step Functions branch fails", async () => {
    mocked.mockRejectedValue(new Error("firehose down"));
    await expect(warehouseRebuildController(TASK, CONTEXT)).rejects.toThrow("firehose down");
  });
});
