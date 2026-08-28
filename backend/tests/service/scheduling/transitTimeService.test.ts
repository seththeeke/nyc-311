import { describe, expect, it } from "vitest";
import { mockTransitTimeEstimator } from "../../../service/scheduling/transitTimeService";
import type { Order } from "../../../models/order";
import type { Location } from "../../../models/location";

const order = {} as Order;
const location = {} as Location;

describe("mockTransitTimeEstimator.estimateMinutes", () => {
  it("returns a fixed positive number of minutes, ignoring its arguments", async () => {
    const minutes = await mockTransitTimeEstimator.estimateMinutes(order, location);

    expect(minutes).toBeGreaterThan(0);
    await expect(mockTransitTimeEstimator.estimateMinutes(order, location)).resolves.toBe(minutes);
  });
});
