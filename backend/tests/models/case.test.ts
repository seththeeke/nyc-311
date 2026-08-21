import { describe, expect, it } from "vitest";
import { CreateCaseInputSchema, CASE_TYPES } from "../../models/case";

function makeInput(overrides: Record<string, unknown> = {}): unknown {
  return {
    case_type: "LOCATION_RESOLUTION_FAILURE",
    request_id: "01REQUEST",
    order_id: null,
    reason: "No bbl present in raw_payload",
    ...overrides,
  };
}

describe("CreateCaseInputSchema", () => {
  it("accepts a well-formed input", () => {
    expect(CreateCaseInputSchema.safeParse(makeInput()).success).toBe(true);
  });

  it("accepts every locked case_type value", () => {
    for (const caseType of CASE_TYPES) {
      expect(CreateCaseInputSchema.safeParse(makeInput({ case_type: caseType })).success).toBe(true);
    }
  });

  it("accepts a null request_id when order_id is set instead", () => {
    expect(CreateCaseInputSchema.safeParse(makeInput({ request_id: null, order_id: "01ORDER" })).success).toBe(true);
  });

  it("rejects an unrecognized case_type", () => {
    expect(CreateCaseInputSchema.safeParse(makeInput({ case_type: "SOMETHING_ELSE" })).success).toBe(false);
  });

  it("rejects a missing reason", () => {
    const input = makeInput() as Record<string, unknown>;
    delete input["reason"];
    expect(CreateCaseInputSchema.safeParse(input).success).toBe(false);
  });

  it("rejects an empty-string reason", () => {
    expect(CreateCaseInputSchema.safeParse(makeInput({ reason: "" })).success).toBe(false);
  });
});
