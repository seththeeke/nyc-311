import { describe, expect, it } from "vitest";
import {
  CreateFeatureFlagRequestSchema,
  FeatureFlagInputSchema,
  FeatureFlagSchema,
  TreatmentRequestSchema,
  UpdateFeatureFlagRequestSchema,
  type FeatureFlagInput,
} from "../../models/featureFlag";

const validInput: FeatureFlagInput = {
  description: "Brute-force vs. ML materials cost",
  treatments: ["BRUTE_FORCE", "ML"],
  default_treatment: "BRUTE_FORCE",
  overrides: [{ entity_type: "OPERATOR", entity_id: "op-1", treatment: "ML" }],
  allocations: [{ treatment: "ML", percent: 10 }],
};

function issueMessages(input: unknown): string[] {
  const result = FeatureFlagInputSchema.safeParse(input);
  return result.success ? [] : result.error.issues.map((issue) => issue.message);
}

describe("FeatureFlagInputSchema", () => {
  it("accepts a valid config", () => {
    expect(FeatureFlagInputSchema.parse(validInput)).toEqual(validInput);
  });

  it("rejects a non-ALL_CAPS treatment name", () => {
    expect(issueMessages({ ...validInput, treatments: ["ml"], default_treatment: "ml" }).length).toBeGreaterThan(0);
  });

  it("rejects duplicate treatments", () => {
    expect(issueMessages({ ...validInput, treatments: ["ML", "ML", "BRUTE_FORCE"] })).toContain("Treatments must be unique");
  });

  it("rejects a default that isn't a declared treatment", () => {
    expect(issueMessages({ ...validInput, default_treatment: "OTHER" })).toContain("Must be one of treatments");
  });

  it("rejects an override pointing at an undeclared treatment", () => {
    const overrides = [{ entity_type: "OPERATOR", entity_id: "op-1", treatment: "OTHER" }];
    expect(issueMessages({ ...validInput, overrides })).toContain("Must be one of treatments");
  });

  it("rejects two overrides for the same entity", () => {
    const overrides = [
      { entity_type: "OPERATOR", entity_id: "op-1", treatment: "ML" },
      { entity_type: "OPERATOR", entity_id: "op-1", treatment: "BRUTE_FORCE" },
    ];
    expect(issueMessages({ ...validInput, overrides })).toContain("Duplicate override target");
  });

  it("rejects an allocation pointing at an undeclared treatment", () => {
    expect(issueMessages({ ...validInput, allocations: [{ treatment: "OTHER", percent: 5 }] })).toContain(
      "Must be one of treatments"
    );
  });

  it("rejects two allocations for the same treatment", () => {
    const allocations = [
      { treatment: "ML", percent: 5 },
      { treatment: "ML", percent: 5 },
    ];
    expect(issueMessages({ ...validInput, allocations })).toContain("Duplicate allocation treatment");
  });

  it("rejects allocations summing past 100", () => {
    const allocations = [
      { treatment: "ML", percent: 60 },
      { treatment: "BRUTE_FORCE", percent: 50 },
    ];
    expect(issueMessages({ ...validInput, allocations })).toContain("Allocations must sum to 100 or less");
  });

  it("accepts allocations summing to exactly 100", () => {
    const allocations = [
      { treatment: "ML", percent: 50 },
      { treatment: "BRUTE_FORCE", percent: 50 },
    ];
    expect(FeatureFlagInputSchema.safeParse({ ...validInput, allocations }).success).toBe(true);
  });

  it("rejects a non-integer percent", () => {
    expect(FeatureFlagInputSchema.safeParse({ ...validInput, allocations: [{ treatment: "ML", percent: 2.5 }] }).success).toBe(false);
  });

  it("rejects unknown fields", () => {
    expect(FeatureFlagInputSchema.safeParse({ ...validInput, extra: true }).success).toBe(false);
  });
});

describe("CreateFeatureFlagRequestSchema / UpdateFeatureFlagRequestSchema", () => {
  it("requires a well-formed flag_key on create", () => {
    expect(CreateFeatureFlagRequestSchema.safeParse({ ...validInput, flag_key: "COST_MODEL" }).success).toBe(true);
    expect(CreateFeatureFlagRequestSchema.safeParse({ ...validInput, flag_key: "cost-model" }).success).toBe(false);
  });

  it("requires expected_version on update", () => {
    expect(UpdateFeatureFlagRequestSchema.safeParse({ ...validInput, expected_version: 3 }).success).toBe(true);
    expect(UpdateFeatureFlagRequestSchema.safeParse(validInput).success).toBe(false);
  });

  it("applies the cross-field rules on create and update too", () => {
    expect(CreateFeatureFlagRequestSchema.safeParse({ ...validInput, flag_key: "K", default_treatment: "X" }).success).toBe(false);
    expect(UpdateFeatureFlagRequestSchema.safeParse({ ...validInput, expected_version: 1, default_treatment: "X" }).success).toBe(false);
  });
});

describe("FeatureFlagSchema", () => {
  it("accepts a stored flag", () => {
    const stored = {
      ...validInput,
      flag_key: "COST_MODEL",
      version: 1,
      created_at: "2026-09-27T00:00:00.000Z",
      updated_at: "2026-09-27T00:00:00.000Z",
      updated_by: "01ADMIN",
    };
    expect(FeatureFlagSchema.parse(stored)).toEqual(stored);
  });
});

describe("TreatmentRequestSchema", () => {
  it("accepts an empty context and an operator_id", () => {
    expect(TreatmentRequestSchema.safeParse({ context: {} }).success).toBe(true);
    expect(TreatmentRequestSchema.safeParse({ context: { operator_id: "op-1" } }).success).toBe(true);
  });

  it("rejects an unsupported context field", () => {
    expect(TreatmentRequestSchema.safeParse({ context: { order_id: "o-1" } }).success).toBe(false);
  });

  it("requires a context", () => {
    expect(TreatmentRequestSchema.safeParse({}).success).toBe(false);
  });
});
