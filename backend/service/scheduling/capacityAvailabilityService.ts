/*
 * Pluggable interface (6-order-scheduling.md §4), matching
 * capacity-model.md §4.2's own description: "the interface the
 * execution/dispatch engine actually queries... The engine has no
 * knowledge of shifts, forecasting, or staffing strategy — it just
 * consumes an availability number."
 */

export interface CapacityAvailabilityProvider {
  /** Units available for `pool` (an `"AGENCY#BOROUGH"` key, ddb-design.md's Shifts `gsi1-pool` shape). */
  getAvailableUnits(pool: string): Promise<number>;
}

/**
 * Real per-pool, admin-configurable unit counts (capacity-model.md §6)
 * don't exist yet — every pool gets this same fixed number, no inspection
 * of `pool` at all, same "stub proves the shape" restraint as every other
 * v1 mock in this project. This is a per-run scheduling budget, not live
 * concurrent capacity (no in-flight tracking exists yet) — see
 * 6-order-scheduling.md §4 for why.
 */
const MOCK_POOL_CAPACITY_UNITS = 5;

export const mockCapacityAvailabilityProvider: CapacityAvailabilityProvider = {
  async getAvailableUnits(): Promise<number> {
    return MOCK_POOL_CAPACITY_UNITS;
  },
};
