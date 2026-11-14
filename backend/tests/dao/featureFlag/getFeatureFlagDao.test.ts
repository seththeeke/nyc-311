import { afterEach, describe, expect, it, vi } from "vitest";
import { FeatureFlagDao } from "../../../dao/featureFlag/featureFlagDao";
import { getFeatureFlagDao } from "../../../dao/featureFlag/getFeatureFlagDao";

describe("getFeatureFlagDao", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("builds a new FeatureFlagDao on every call", () => {
    vi.stubEnv("FEATURE_FLAGS_TABLE_NAME", "FeatureFlags-Test");
    const dao = getFeatureFlagDao();
    expect(dao).toBeInstanceOf(FeatureFlagDao);
    expect(getFeatureFlagDao()).not.toBe(dao);
  });

  it("throws when FEATURE_FLAGS_TABLE_NAME is missing", () => {
    vi.stubEnv("FEATURE_FLAGS_TABLE_NAME", "");
    expect(() => getFeatureFlagDao()).toThrow("FEATURE_FLAGS_TABLE_NAME");
  });
});
