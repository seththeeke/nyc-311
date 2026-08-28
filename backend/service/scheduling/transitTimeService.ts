import type { Order } from "../../models/order";
import type { Location } from "../../models/location";

/*
 * Pluggable interface (6-order-scheduling.md §5), matching
 * capacity-model.md §3.1's own shape — kept separate from
 * ProcessingTimeEstimator so a real implementation (Haversine distance,
 * then later a real routing API) can swap in independently.
 */
export interface TransitTimeEstimator {
  /** Minutes to reach `location` from the pool's depot. */
  estimateMinutes(order: Order, location: Location): Promise<number>;
}

/**
 * v1 (mock) implementation: a fixed constant, no inspection of `order`/
 * `location` at all. One level simpler than capacity-model.md §3.1's own
 * already-specced v1 (Haversine distance / assumed driving speed) —
 * deferred to whichever doc first needs a real duration; this interface is
 * shaped so that's a drop-in swap, not a redesign.
 */
const MOCK_TRANSIT_MINUTES = 20;

export const mockTransitTimeEstimator: TransitTimeEstimator = {
  async estimateMinutes(): Promise<number> {
    return MOCK_TRANSIT_MINUTES;
  },
};
