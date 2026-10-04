import type { CostModel, Order } from "../../models/order";
import type { Request } from "../../models/request";

/*
 * Pluggable interface (11-street-condition-implementation.md §5), same
 * shape as ProcessingTimeEstimator. Labor cost is never estimated here — it
 * derives from rate_per_hour × hours worked; this covers materials only.
 */
export interface MaterialsCostEstimator {
  /** Which model produced the estimate, stamped on ORDER_SCHEDULED so history stays labeled. */
  readonly costModel: CostModel;
  /** Expected materials cost in USD for `order`/`request`, before execution variance. */
  estimateCost(order: Order, request: Request): Promise<number>;
}
