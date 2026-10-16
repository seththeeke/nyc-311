import type { FeatureFlag } from "../models/featureFlag";

/* Baked sample data for "mock" data mode — the planned COST_MODEL flag, the Customers page gate, and a plain on/off one. */
export const MOCK_FEATURE_FLAGS: FeatureFlag[] = [
  {
    flag_key: "COST_MODEL",
    description: "Which MaterialsCostEstimator scheduling uses (Topic 5).",
    treatments: ["BRUTE_FORCE", "ML"],
    default_treatment: "BRUTE_FORCE",
    overrides: [{ entity_type: "OPERATOR", entity_id: "01MOCKOPERATOR000", treatment: "ML" }],
    allocations: [{ treatment: "ML", percent: 10 }],
    version: 3,
    created_at: "2026-09-27T12:00:00.000Z",
    updated_at: "2026-09-27T12:30:00.000Z",
    updated_by: "01MOCKADMIN",
  },
  {
    flag_key: "CUSTOMERS_TAB",
    description: "Shows the Residents page under Map (13-customer-simulation.md §4). C = hidden, T1 = shown. On here so mock mode shows the page.",
    treatments: ["C", "T1"],
    default_treatment: "T1",
    overrides: [],
    allocations: [],
    version: 1,
    created_at: "2026-10-14T12:00:00.000Z",
    updated_at: "2026-10-14T12:00:00.000Z",
    updated_by: "01MOCKADMIN",
  },
  {
    flag_key: "FAILURE_INJECTION",
    description: "Chaos mode for the order pipeline (#36).",
    treatments: ["OFF", "ON"],
    default_treatment: "OFF",
    overrides: [],
    allocations: [],
    version: 1,
    created_at: "2026-09-27T12:00:00.000Z",
    updated_at: "2026-09-27T12:00:00.000Z",
    updated_by: "01MOCKADMIN",
  },
];
