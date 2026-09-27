import type { FeatureFlag } from "../../../models/featureFlag";
import type { User } from "../../../models/user";

/* Shared across the six feature-flag controller tests. */

export const admin: User = {
  user_id: "01ADMIN",
  type: "ADMIN",
  status: "ACTIVE",
  created_at: "2026-09-27T00:00:00.000Z",
  updated_at: "2026-09-27T00:00:00.000Z",
  last_active_at: "2026-09-27T00:00:00.000Z",
  cognito_sub: "abc-123",
  email: "admin@example.com",
  display_name: null,
};

export const flag: FeatureFlag = {
  flag_key: "COST_MODEL",
  description: "",
  treatments: ["BRUTE_FORCE", "ML"],
  default_treatment: "BRUTE_FORCE",
  overrides: [],
  allocations: [{ treatment: "ML", percent: 10 }],
  version: 1,
  created_at: "2026-09-27T00:00:00.000Z",
  updated_at: "2026-09-27T00:00:00.000Z",
  updated_by: "01ADMIN",
};

export const flagInput = {
  description: flag.description,
  treatments: flag.treatments,
  default_treatment: flag.default_treatment,
  overrides: flag.overrides,
  allocations: flag.allocations,
};

export function httpEvent(options: { method: string; path: string; pathParameters?: Record<string, string>; body?: string | null }): unknown {
  return {
    rawPath: options.path,
    requestContext: {
      http: { method: options.method },
      authorizer: { jwt: { claims: { sub: "abc-123", email: "admin@example.com" } } },
    },
    pathParameters: options.pathParameters,
    body: options.body,
  };
}
