import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resolveDispatchPolicy } from "../../../service/scheduling/dispatchPolicyService";

beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("resolveDispatchPolicy", () => {
  it("reads DISPATCH_POLICY with the empty context, fallback C and the three treatments", async () => {
    const getTreatment = vi.fn().mockResolvedValue("C");

    await resolveDispatchPolicy({ getTreatment });

    expect(getTreatment).toHaveBeenCalledWith("DISPATCH_POLICY", {}, { fallback: "C", treatments: ["C", "T1", "T2"] });
  });

  it("applies C when the flag says C", async () => {
    const result = await resolveDispatchPolicy({ getTreatment: vi.fn().mockResolvedValue("C") });

    expect(result).toEqual({ flagTreatment: "C", appliedPolicy: "C" });
  });

  it.each(["T1", "T2"])("runs %s as C with a WARN until that policy is built", async (treatment) => {
    const result = await resolveDispatchPolicy({ getTreatment: vi.fn().mockResolvedValue(treatment) });

    expect(result).toEqual({ flagTreatment: treatment, appliedPolicy: "C" });
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining("DispatchPolicyNotImplemented"));
  });

  it("treats a value outside the policy set as C", async () => {
    const result = await resolveDispatchPolicy({ getTreatment: vi.fn().mockResolvedValue("BOGUS") });

    expect(result).toEqual({ flagTreatment: "C", appliedPolicy: "C" });
  });

  it("defaults to the real flag read, which falls back to C when the flag table isn't configured", async () => {
    const result = await resolveDispatchPolicy();

    expect(result.appliedPolicy).toBe("C");
  });
});
