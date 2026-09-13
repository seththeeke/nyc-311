import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Context } from "aws-lambda";
import { runWarehouseJob } from "../../../service/analytics/warehouseJobRunnerService";
import { runWarehouseJobController } from "../../../controller/analytics/runWarehouseJobController";
import { ValidationError } from "../../../models/errors";
import type { WarehouseJobRun } from "../../../models/warehouseJobRun";

vi.mock("../../../service/analytics/warehouseJobRunnerService", () => ({ runWarehouseJob: vi.fn() }));
const mocked = vi.mocked(runWarehouseJob);

const ctx = { awsRequestId: "req-1" } as Context;

function run(overrides: Partial<WarehouseJobRun>): WarehouseJobRun {
  return {
    job_run_id: "01RUN",
    job_name: "order_volume_by_stage_7d",
    status: "SUCCEEDED",
    trigger: "SCHEDULED",
    started_at: "2026-09-07T09:00:00.000Z",
    completed_at: "2026-09-07T09:00:12.000Z",
    execution_ref: "q-1",
    result_location: "s3://b/k",
    row_count: 21,
    error_message: null,
    retry_count: 0,
    retried_from_job_run_id: null,
    data_scanned_bytes: 2048,
    engine_execution_time_ms: 1500,
    query_queue_time_ms: 30,
    ...overrides,
  };
}

beforeEach(() => {
  mocked.mockReset();
  vi.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("runWarehouseJobController", () => {
  it("validates the {job_name} trigger and returns the run", async () => {
    const result = run({ job_name: "order_volume_by_borough" });
    mocked.mockResolvedValue(result);

    const response = await runWarehouseJobController({ job_name: "order_volume_by_borough" }, ctx);

    expect(mocked).toHaveBeenCalledWith("order_volume_by_borough");
    expect(response).toEqual(result);
  });

  it("throws ValidationError for a trigger missing job_name, without running anything", async () => {
    await expect(runWarehouseJobController({}, ctx)).rejects.toBeInstanceOf(ValidationError);
    await expect(runWarehouseJobController("nope", ctx)).rejects.toBeInstanceOf(ValidationError);
    expect(mocked).not.toHaveBeenCalled();
  });

  it("lets a runner-level failure propagate (the schedule's DLQ + error alarm catch it)", async () => {
    mocked.mockRejectedValue(new Error("No job named \"ghost_job\""));
    await expect(runWarehouseJobController({ job_name: "ghost_job" }, ctx)).rejects.toThrow("No job named");
  });
});
