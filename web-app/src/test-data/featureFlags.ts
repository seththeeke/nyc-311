import type { FeatureFlag } from "../models/featureFlag";

/* Baked sample data for "mock" data mode — the planned COST_MODEL flag plus a plain on/off one. */
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
