import type { Order } from "../../models/order";
import type { Request } from "../../models/request";

/*
 * Pluggable interface (6-order-scheduling.md §5), matching
 * capacity-model.md §3.2's own shape — kept separate from
 * TransitTimeEstimator so a real implementation (per-complaint_type
 * lookup, then later a distribution-sampled model) can swap in
 * independently.
 */
export interface ProcessingTimeEstimator {
  /** Minutes of on-site work once arrived, for `order`/`request`. */
  estimateMinutes(order: Order, request: Request): Promise<number>;
}

/**
 * v1 (mock) implementation: a fixed constant, no inspection of `order`/
 * `request` (including `complaint_type`) at all. One level simpler than
 * capacity-model.md §3.2's own already-specced v1 (a per-complaint_type
 * duration lookup) — deferred to whichever doc first needs a real
 * duration; this interface is shaped so that's a drop-in swap.
 */
const MOCK_PROCESSING_MINUTES = 30;

export const mockProcessingTimeEstimator: ProcessingTimeEstimator = {
  async estimateMinutes(): Promise<number> {
    return MOCK_PROCESSING_MINUTES;
  },
};
