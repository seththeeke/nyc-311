import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Context } from "aws-lambda";
import { scheduleOrders } from "../../../service/scheduling/orderSchedulingService";
import { scheduleOrdersController } from "../../../controller/order-processing/scheduleOrdersController";
import { ValidationError } from "../../../models/errors";
import type { SchedulingRunSummary } from "../../../service/scheduling/orderSchedulingService";

vi.mock("../../../service/scheduling/orderSchedulingService", () => ({
  scheduleOrders: vi.fn(),
}));

const mockedScheduleOrders = vi.mocked(scheduleOrders);
const fakeContext = { awsRequestId: "req-123" } as Context;

beforeEach(() => {
  mockedScheduleOrders.mockReset();
  vi.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("scheduleOrdersController", () => {
  it("validates the trigger payload, calls scheduleOrders, and returns its summary", async () => {
    const summary: SchedulingRunSummary = {
      ordersConsidered: 3,
      ordersScheduled: 2,
      ordersSkippedNoCapacity: 1,
      ordersCasedUnroutable: 0,
      ordersFailed: 0,
    };
    mockedScheduleOrders.mockResolvedValue(summary);

    await expect(scheduleOrdersController({}, fakeContext)).resolves.toEqual(summary);
    expect(mockedScheduleOrders).toHaveBeenCalledTimes(1);
  });

  it("rejects a non-object trigger payload without calling scheduleOrders", async () => {
    await expect(scheduleOrdersController("not-an-object", fakeContext)).rejects.toBeInstanceOf(ValidationError);
    expect(mockedScheduleOrders).not.toHaveBeenCalled();
  });

  it("lets a service failure propagate so the schedule's on-failure DLQ still catches it", async () => {
    const failure = new Error("DynamoDB throttled");
    mockedScheduleOrders.mockRejectedValue(failure);

    await expect(scheduleOrdersController({}, fakeContext)).rejects.toBe(failure);
  });
});
