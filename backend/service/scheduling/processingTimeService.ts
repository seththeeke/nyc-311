import type { Order } from "../../models/order";
import type { Request } from "../../models/request";

/*
 * Pluggable interface (6-order-scheduling.md §5), matching
 * capacity-model.md §3.2's own shape — kept separate from
 * TransitTimeEstimator so each can swap independently. The v1
 * implementation is streetConditionProcessingTimeEstimator.
 */
export interface ProcessingTimeEstimator {
  /**
   * Expected minutes of on-site work once arrived, for `order`/`request` —
   * the expectation only; execution applies its own random variance.
   */
  estimateMinutes(order: Order, request: Request): Promise<number>;
}
