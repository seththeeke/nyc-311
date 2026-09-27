import { describe, expect, it } from "vitest";
import {
  defaultShare,
  draftIssues,
  draftToInput,
  emptyDraft,
  parseTreatments,
  summarizeAllocations,
  toDraft,
} from "../../../src/components/featureFlags/featureFlagDraft";
import { MOCK_FEATURE_FLAGS } from "../../../src/test-data/featureFlags";

const flag = MOCK_FEATURE_FLAGS[0];

describe("featureFlagDraft", () => {
  it("round-trips a flag through a draft", () => {
    const draft = toDraft(flag);
    expect(draft.treatmentsText).toBe("BRUTE_FORCE, ML");
    expect(draftToInput(draft)).toEqual({
      description: flag.description,
      treatments: flag.treatments,
      default_treatment: flag.default_treatment,
      overrides: flag.overrides,
      allocations: flag.allocations,
    });
  });

  it("parses comma-separated treatments, dropping blanks", () => {
    expect(parseTreatments(" A, B ,, C ")).toEqual(["A", "B", "C"]);
  });

  it("reports no issues for a valid existing flag", () => {
    expect(draftIssues(toDraft(flag), false)).toEqual([]);
  });

  it("requires a valid key only for a new flag", () => {
    expect(draftIssues(emptyDraft(), true)).toContain("Flag key: Must be ALL_CAPS (A-Z, 0-9, _), max 64 chars");
    expect(draftIssues({ ...emptyDraft(), flag_key: "NEW" }, true)).toEqual([]);
    expect(draftIssues(emptyDraft(), false)).toEqual([]);
  });

  it("de-duplicates config issues", () => {
    const draft = { ...toDraft(flag), allocations: [{ treatment: "ML", percent: 0 }, { treatment: "ML", percent: 0 }] };
    const issues = draftIssues(draft, false);
    expect(issues.filter((issue) => issue === "Percent must be 1-100")).toHaveLength(1);
  });

  it("computes the default's share and summarizes allocations", () => {
    expect(defaultShare([{ treatment: "A", percent: 30 }, { treatment: "B", percent: Number.NaN }])).toBe(70);
    expect(summarizeAllocations([])).toBe("—");
    expect(summarizeAllocations(flag.allocations)).toBe("ML 10%");
  });
});
