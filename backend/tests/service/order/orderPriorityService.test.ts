import { describe, expect, it } from "vitest";
import { MockOrderPriorityAssigner } from "../../../service/order/orderPriorityService";

describe("MockOrderPriorityAssigner", () => {
  it("always assigns the fixed STANDARD tier", async () => {
    const assigner = new MockOrderPriorityAssigner();

    const { priorityTier } = await assigner.assign();

    expect(priorityTier).toBe("STANDARD");
  });

  it("stamps an SLA deadline 24h after now", async () => {
    const now = new Date("2026-08-26T00:00:00.000Z");
    const assigner = new MockOrderPriorityAssigner({ now: () => now });

    const { slaDeadline } = await assigner.assign();

    expect(slaDeadline).toBe("2026-08-27T00:00:00.000Z");
  });

  it("defaults `now` to the real clock when not injected", async () => {
    const assigner = new MockOrderPriorityAssigner();

    const { slaDeadline } = await assigner.assign();

    expect(new Date(slaDeadline).getTime()).toBeGreaterThan(Date.now());
  });
});
