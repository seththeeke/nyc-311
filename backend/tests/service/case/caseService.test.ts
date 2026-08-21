import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createCase } from "../../../service/case/caseService";
import { ValidationError } from "../../../models/errors";
import type { CreateCaseInput } from "../../../models/case";

const validInput: CreateCaseInput = {
  case_type: "LOCATION_RESOLUTION_FAILURE",
  request_id: "01REQUEST",
  order_id: null,
  reason: "No bbl present in raw_payload",
};

beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("createCase", () => {
  it("logs the input and resolves without touching any persistence", async () => {
    const warnSpy = vi.spyOn(console, "warn");
    await expect(createCase(validInput)).resolves.toBeUndefined();
    expect(warnSpy).toHaveBeenCalledTimes(1);
    const logged = JSON.parse(warnSpy.mock.calls[0][0] as string);
    expect(logged).toMatchObject({ message: "CaseCreationStub", input: validInput });
  });

  it("throws ValidationError for a malformed input", async () => {
    // @ts-expect-error intentionally invalid for the test
    await expect(createCase({ case_type: "NOT_A_REAL_TYPE" })).rejects.toBeInstanceOf(ValidationError);
  });
});
