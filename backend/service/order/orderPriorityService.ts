import type { Order } from "../../models/order";

/*
 * Pluggable interface (5-order-evaluation.md §4), same pattern as
 * LocationResolver/TransitTimeEstimator/ProcessingTimeEstimator elsewhere
 * in this project. Stamps the fields an accepted Order needs to actually
 * appear in gsi1-stage-sla once current_stage moves to SCHEDULE — without
 * them, the item wouldn't be projected into that GSI at all (DynamoDB GSIs
 * require the sort-key attribute to be present).
 */

export interface OrderPriorityAssignment {
  priorityTier: string;
  slaDeadline: string;
}

export interface OrderPriorityAssigner {
  assign(order: Order): Promise<OrderPriorityAssignment>;
}

/** Real per-complaint_type tiers and admin-configurable SLA thresholds (capacity-model.md §5/§6) don't exist yet — fixed for every Order. */
const MOCK_PRIORITY_TIER = "STANDARD";

/** Arbitrary placeholder SLA window — real thresholds are an admin-configurable business input not yet built. */
const MOCK_SLA_HOURS = 24;

export interface MockOrderPriorityAssignerDeps {
  now?: () => Date;
}

/**
 * v1 (mock) implementation (`5-order-evaluation.md` §4): fixed tier, fixed
 * SLA offset from now, no inspection of `complaint_type` or anything else
 * — proves the `PriorityAssigned` field-stamping shape without deciding
 * any real business rule.
 */
export class MockOrderPriorityAssigner implements OrderPriorityAssigner {
  private readonly now: () => Date;

  constructor(deps: MockOrderPriorityAssignerDeps = {}) {
    this.now = deps.now ?? (() => new Date());
  }

  async assign(): Promise<OrderPriorityAssignment> {
    const slaDeadline = new Date(this.now().getTime() + MOCK_SLA_HOURS * 60 * 60 * 1000).toISOString();
    return { priorityTier: MOCK_PRIORITY_TIER, slaDeadline };
  }
}
