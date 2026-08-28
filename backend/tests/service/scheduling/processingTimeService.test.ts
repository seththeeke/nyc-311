import { describe, expect, it } from "vitest";
import { mockProcessingTimeEstimator } from "../../../service/scheduling/processingTimeService";
import type { Order } from "../../../models/order";
import type { Request } from "../../../models/request";

const order = {} as Order;
const request = {} as Request;

describe("mockProcessingTimeEstimator.estimateMinutes", () => {
  it("returns a fixed positive number of minutes, ignoring its arguments", async () => {
    const minutes = await mockProcessingTimeEstimator.estimateMinutes(order, request);

    expect(minutes).toBeGreaterThan(0);
    await expect(mockProcessingTimeEstimator.estimateMinutes(order, request)).resolves.toBe(minutes);
  });
});
