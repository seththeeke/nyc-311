import { describe, expect, it } from "vitest";
import { mockCapacityAvailabilityProvider } from "../../../service/scheduling/capacityAvailabilityService";

describe("mockCapacityAvailabilityProvider.getAvailableUnits", () => {
  it("returns the same fixed unit count regardless of pool", async () => {
    const first = await mockCapacityAvailabilityProvider.getAvailableUnits("DSNY#QUEENS");
    const second = await mockCapacityAvailabilityProvider.getAvailableUnits("NYPD#BROOKLYN");

    expect(first).toBe(second);
    expect(first).toBeGreaterThan(0);
  });
});
