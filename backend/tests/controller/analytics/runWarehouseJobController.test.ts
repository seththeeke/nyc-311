import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Context } from "aws-lambda";
import { runSampleWarehouseJob } from "../../../service/analytics/warehouseJobRunnerService";
import { runWarehouseJobController } from "../../../controller/analytics/runWarehouseJobController";
import { ValidationError } from "../../../models/errors";
import type { WarehouseJobRun } from "../../../models/warehouseJobRun";

vi.mock("../../../service/analytics/warehouseJobRunnerService", () => ({ runSampleWarehouseJob: vi.fn() }));
const mocked = vi.mocked(runSampleWarehouseJob);

const ctx = { awsRequestId: "req-1" } as Context;

const succeededRun: WarehouseJobRun = {
  job_run_id: "01RUN",
  job_name: "ORDER_VOLUME_BY_STAGE",
  status: "SUCCEEDED",
  trigger: "SCHEDULED",
  started_at: "2026-09-06T09:00:00.000Z",
  completed_at: "2026-09-06T09:00:12.000Z",
  execution_ref: "q-1",
  error_message: null,
  retry_count: 0,
  retried_from_job_run_id: null,
  data_scanned_bytes: 2048,
  engine_execution_time_ms: 1500,
  query_queue_time_ms: 30,
};

beforeEach(() => {
  mocked.mockReset();
  vi.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("runWarehouseJobController", () => {
  it("validates the (empty) trigger and returns the run", async () => {
    mocked.mockResolvedValue(succeededRun);
    const result = await runWarehouseJobController({}, ctx);
    expect(mocked).toHaveBeenCalledOnce();
    expect(result).toEqual(succeededRun);
  });

  it("throws ValidationError for a non-object trigger, without running the job", async () => {
    await expect(runWarehouseJobController("nope", ctx)).rejects.toBeInstanceOf(ValidationError);
    expect(mocked).not.toHaveBeenCalled();
  });

  it("lets a job failure propagate (the schedule's DLQ still catches it)", async () => {
    mocked.mockRejectedValue(new Error("Athena query FAILED"));
    await expect(runWarehouseJobController({}, ctx)).rejects.toThrow("Athena query FAILED");
  });
});
