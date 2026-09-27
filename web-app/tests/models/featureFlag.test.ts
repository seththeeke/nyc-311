import { describe, expect, it } from "vitest";
import { FeatureFlagInputSchema, FeatureFlagListSchema, FlagKeySchema, type FeatureFlagInput } from "../../src/models/featureFlag";
import { MOCK_FEATURE_FLAGS } from "../../src/test-data/featureFlags";

const valid: FeatureFlagInput = {
  description: "",
  treatments: ["A", "B"],
  default_treatment: "A",
  overrides: [{ entity_type: "OPERATOR", entity_id: "op-1", treatment: "B" }],
  allocations: [{ treatment: "B", percent: 40 }],
};

function messages(input: unknown): string[] {
  const result = FeatureFlagInputSchema.safeParse(input);
  return result.success ? [] : result.error.issues.map((issue) => issue.message);
}

describe("FeatureFlagInputSchema", () => {
  it("accepts a valid config", () => {
    expect(messages(valid)).toEqual([]);
  });

  it("reports every cross-field problem", () => {
    expect(messages({ ...valid, treatments: ["A", "A"] })).toContain("Treatments must be unique");
    expect(messages({ ...valid, default_treatment: "C" })).toContain("Default must be one of the treatments");
    expect(messages({ ...valid, overrides: [{ entity_type: "OPERATOR", entity_id: "op-1", treatment: "C" }] })).toContain(
      "Override for op-1 uses an undeclared treatment"
    );
    expect(messages({ ...valid, overrides: [valid.overrides[0], valid.overrides[0]] })).toContain("Duplicate override for op-1");
    expect(messages({ ...valid, allocations: [{ treatment: "C", percent: 5 }] })).toContain("Allocation uses an undeclared treatment C");
    expect(messages({ ...valid, allocations: [{ treatment: "B", percent: 5 }, { treatment: "B", percent: 5 }] })).toContain(
      "Duplicate allocation for B"
    );
    expect(messages({ ...valid, allocations: [{ treatment: "A", percent: 60 }, { treatment: "B", percent: 60 }] })).toContain(
      "Allocations must sum to 100 or less"
    );
  });

  it("rejects a lowercase treatment and a fractional percent", () => {
    expect(messages({ ...valid, treatments: ["a"], default_treatment: "a" }).length).toBeGreaterThan(0);
    expect(messages({ ...valid, allocations: [{ treatment: "B", percent: 1.5 }] })).toContain("Percent must be a whole number");
  });
});

describe("FlagKeySchema / FeatureFlagListSchema", () => {
  it("validates flag keys", () => {
    expect(FlagKeySchema.safeParse("COST_MODEL").success).toBe(true);
    expect(FlagKeySchema.safeParse("cost").success).toBe(false);
  });

  it("parses the baked mock flags as a list response", () => {
    expect(FeatureFlagListSchema.parse({ flags: MOCK_FEATURE_FLAGS }).flags).toHaveLength(MOCK_FEATURE_FLAGS.length);
  });
});
