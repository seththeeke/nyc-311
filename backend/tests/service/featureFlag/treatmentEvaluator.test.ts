import { describe, expect, it } from "vitest";
import { evaluateTreatment } from "../../../service/featureFlag/treatmentEvaluator";
import type { FeatureFlag } from "../../../models/featureFlag";

const flag: FeatureFlag = {
  flag_key: "EXPERIMENT",
  description: "",
  treatments: ["A", "B", "C"],
  default_treatment: "A",
  overrides: [{ entity_type: "OPERATOR", entity_id: "op-pinned", treatment: "C" }],
  allocations: [
    { treatment: "B", percent: 20 },
    { treatment: "C", percent: 30 },
  ],
  version: 1,
  created_at: "2026-09-27T00:00:00.000Z",
  updated_at: "2026-09-27T00:00:00.000Z",
  updated_by: "01ADMIN",
};

describe("evaluateTreatment", () => {
  it("returns the override for a matching operator without drawing", () => {
    const random = () => {
      throw new Error("should not draw");
    };
    expect(evaluateTreatment(flag, { operator_id: "op-pinned" }, random)).toEqual({ treatment: "C", reason: "OVERRIDE" });
  });

  it("walks allocations cumulatively for a non-overridden operator", () => {
    expect(evaluateTreatment(flag, { operator_id: "op-other" }, () => 0)).toEqual({ treatment: "B", reason: "ALLOCATION" });
    expect(evaluateTreatment(flag, {}, () => 0.1999)).toEqual({ treatment: "B", reason: "ALLOCATION" });
    expect(evaluateTreatment(flag, {}, () => 0.2)).toEqual({ treatment: "C", reason: "ALLOCATION" });
    expect(evaluateTreatment(flag, {}, () => 0.4999)).toEqual({ treatment: "C", reason: "ALLOCATION" });
  });

  it("falls through to the default for the unallocated remainder", () => {
    expect(evaluateTreatment(flag, {}, () => 0.5)).toEqual({ treatment: "A", reason: "DEFAULT" });
    expect(evaluateTreatment(flag, {}, () => 0.9999)).toEqual({ treatment: "A", reason: "DEFAULT" });
  });

  it("returns the default for a flag with no overrides or allocations", () => {
    const plain: FeatureFlag = { ...flag, overrides: [], allocations: [] };
    expect(evaluateTreatment(plain, { operator_id: "op-pinned" })).toEqual({ treatment: "A", reason: "DEFAULT" });
  });

  it("uses Math.random by default, always landing in 100% allocation", () => {
    const full: FeatureFlag = { ...flag, overrides: [], allocations: [{ treatment: "B", percent: 100 }] };
    expect(evaluateTreatment(full, {})).toEqual({ treatment: "B", reason: "ALLOCATION" });
  });
});
