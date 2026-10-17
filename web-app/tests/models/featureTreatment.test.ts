import { describe, expect, it } from "vitest";
import { CUSTOMERS_TAB_FLAG, CUSTOMERS_TAB_ON, FeatureTreatmentSchema } from "../../src/models/featureTreatment";

describe("FeatureTreatmentSchema", () => {
  it("reads the treatment route's response and rejects one with no treatment", () => {
    expect(FeatureTreatmentSchema.parse({ flag_key: "CUSTOMERS_TAB", treatment: "T1" })).toEqual({ flag_key: "CUSTOMERS_TAB", treatment: "T1" });
    expect(FeatureTreatmentSchema.safeParse({ flag_key: "CUSTOMERS_TAB" }).success).toBe(false);
  });

  it("names the Residents page flag and its on treatment", () => {
    expect([CUSTOMERS_TAB_FLAG, CUSTOMERS_TAB_ON]).toEqual(["CUSTOMERS_TAB", "T1"]);
  });
});
