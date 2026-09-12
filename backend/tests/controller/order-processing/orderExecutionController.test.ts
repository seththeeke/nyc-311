import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { orderExecutionController } from "../../../controller/order-processing/orderExecutionController";
import { arriveAtJob, dispatchOrder, resolveOrder } from "../../../service/execution/orderExecutionService";
import { ValidationError } from "../../../models/errors";

vi.mock("../../../service/execution/orderExecutionService", () => ({
  dispatchOrder: vi.fn(),
  arriveAtJob: vi.fn(),
  resolveOrder: vi.fn(),
}));

const mockedDispatchOrder = vi.mocked(dispatchOrder);
const mockedArriveAtJob = vi.mocked(arriveAtJob);
const mockedResolveOrder = vi.mocked(resolveOrder);

beforeEach(() => {
  mockedDispatchOrder.mockReset();
  mockedArriveAtJob.mockReset();
  mockedResolveOrder.mockReset();
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("orderExecutionController", () => {
  it("routes a DISPATCH task to dispatchOrder and returns its result", async () => {
    mockedDispatchOrder.mockResolvedValue({ transit_wait_seconds: 12, processing_wait_seconds: 18 });

    const result = await orderExecutionController({
      phase: "DISPATCH",
      order_id: "01ORDER",
      operator_id: "01OPERATOR",
      job_location: { lat: 40.75, lng: -73.98 },
      transit_minutes: 20,
      processing_minutes: 30,
    });

    expect(mockedDispatchOrder).toHaveBeenCalledWith("01ORDER", 20, 30);
    expect(result).toEqual({ transit_wait_seconds: 12, processing_wait_seconds: 18 });
  });

  it("routes an ARRIVE task to arriveAtJob and returns an empty object", async () => {
    mockedArriveAtJob.mockResolvedValue(undefined);

    const result = await orderExecutionController({
      phase: "ARRIVE",
      order_id: "01ORDER",
      operator_id: "01OPERATOR",
      job_location: { lat: 40.75, lng: -73.98 },
    });

    expect(mockedArriveAtJob).toHaveBeenCalledWith("01ORDER", "01OPERATOR", { lat: 40.75, lng: -73.98 });
    expect(result).toEqual({});
  });

  it("routes a RESOLVE task to resolveOrder and returns an empty object", async () => {
    mockedResolveOrder.mockResolvedValue(undefined);

    const result = await orderExecutionController({ phase: "RESOLVE", order_id: "01ORDER", operator_id: "01OPERATOR" });

    expect(mockedResolveOrder).toHaveBeenCalledWith("01ORDER", "01OPERATOR");
    expect(result).toEqual({});
  });

  it("throws ValidationError for a malformed task, without calling any service function", async () => {
    await expect(orderExecutionController({ phase: "BOGUS" })).rejects.toBeInstanceOf(ValidationError);

    expect(mockedDispatchOrder).not.toHaveBeenCalled();
    expect(mockedArriveAtJob).not.toHaveBeenCalled();
    expect(mockedResolveOrder).not.toHaveBeenCalled();
  });

  it("lets a service failure propagate", async () => {
    const failure = new Error("optimistic-lock lost");
    mockedResolveOrder.mockRejectedValue(failure);

    await expect(
      orderExecutionController({ phase: "RESOLVE", order_id: "01ORDER", operator_id: "01OPERATOR" })
    ).rejects.toBe(failure);
  });
});
