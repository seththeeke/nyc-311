import type { Context } from "aws-lambda";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as service from "../../../service/analytics/warehouseRebuildService";
import { warehouseRebuildController } from "../../../controller/data-archival/warehouseRebuildController";
import { ValidationError } from "../../../models/errors";

vi.mock("../../../service/analytics/warehouseRebuildService", () => ({
  wipeAndListExport: vi.fn(),
  replayExportChunk: vi.fn(),
  finalizeRebuild: vi.fn(),
  markRebuildFailed: vi.fn(),
}));

const CONTEXT = { awsRequestId: "req-1" } as Context;
const ARN = "arn:aws:dynamodb:us-east-1:111:table/Orders-Test/export/01ID";

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("warehouseRebuildController", () => {
  it("dispatches phase=wipe", async () => {
    vi.mocked(service.wipeAndListExport).mockResolvedValue({ job_run_id: "01RUN", chunks: [{ fileKey: "f", start: 0, count: 10 }] });
    const res = await warehouseRebuildController(
      { phase: "wipe", source: "orders", exportArn: ARN, startedAt: "2026-09-08T12:00:00.000Z" },
      CONTEXT
    );
    expect(res).toEqual({ job_run_id: "01RUN", chunks: [{ fileKey: "f", start: 0, count: 10 }] });
    expect(service.wipeAndListExport).toHaveBeenCalledOnce();
  });

  it("dispatches phase=replay", async () => {
    vi.mocked(service.replayExportChunk).mockResolvedValue({ order_events: 3 });
    const res = await warehouseRebuildController(
      { phase: "replay", source: "orders", chunk: { fileKey: "f", start: 0, count: 10 }, exportTime: "2026-09-08T12:00:00.000Z" },
      CONTEXT
    );
    expect(res).toEqual({ order_events: 3 });
  });

  it("dispatches phase=finalize", async () => {
    vi.mocked(service.finalizeRebuild).mockResolvedValue({
      source: "orders",
      job_run_id: "01RUN",
      replayed_by_table: { order_events: 3 },
      total_replayed: 3,
    });
    const res = await warehouseRebuildController(
      {
        phase: "finalize",
        source: "orders",
        exportArn: ARN,
        jobRunId: "01RUN",
        startedAt: "2026-09-08T12:00:00.000Z",
        replayResults: [{ order_events: 3 }],
      },
      CONTEXT
    );
    expect(res).toMatchObject({ total_replayed: 3 });
  });

  it("dispatches phase=fail", async () => {
    vi.mocked(service.markRebuildFailed).mockResolvedValue(undefined);
    const res = await warehouseRebuildController(
      { phase: "fail", source: "requests", exportArn: ARN, startedAt: "2026-09-08T12:00:00.000Z", jobRunId: "01RUN", error: "boom" },
      CONTEXT
    );
    expect(res).toEqual({ source: "requests", status: "FAILED" });
    expect(service.markRebuildFailed).toHaveBeenCalledOnce();
  });

  it("throws a ValidationError on a malformed / unknown-phase task, calling no service fn", async () => {
    await expect(warehouseRebuildController({ phase: "nope" }, CONTEXT)).rejects.toBeInstanceOf(ValidationError);
    expect(service.wipeAndListExport).not.toHaveBeenCalled();
    expect(service.replayExportChunk).not.toHaveBeenCalled();
  });

  it("lets a service error propagate so the state machine fails the branch", async () => {
    vi.mocked(service.replayExportChunk).mockRejectedValue(new Error("firehose down"));
    await expect(
      warehouseRebuildController(
        { phase: "replay", source: "orders", chunk: { fileKey: "f", start: 0, count: 10 }, exportTime: "2026-09-08T12:00:00.000Z" },
        CONTEXT
      )
    ).rejects.toThrow("firehose down");
  });
});
