import { describe, expect, it } from "vitest";
import { FeatureTreatmentSchema } from "../../src/models/featureTreatment";

describe("FeatureTreatmentSchema", () => {
  it("reads the treatment route's response and rejects one with no treatment", () => {
    expect(FeatureTreatmentSchema.parse({ flag_key: "CONTACTS_PAGE", treatment: "T1" })).toEqual({ flag_key: "CONTACTS_PAGE", treatment: "T1" });
    expect(FeatureTreatmentSchema.safeParse({ flag_key: "CONTACTS_PAGE" }).success).toBe(false);
  });
});
