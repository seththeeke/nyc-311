import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { requireEnv } from "../env";

const VAR_NAME = "DEVX_AGENT_TEST_VAR";

beforeEach(() => {
  delete process.env[VAR_NAME];
});

afterEach(() => {
  delete process.env[VAR_NAME];
});

describe("requireEnv", () => {
  it("returns the value when the variable is set", () => {
    process.env[VAR_NAME] = "configured-value";
    expect(requireEnv(VAR_NAME)).toBe("configured-value");
  });

  it("throws a descriptive error when the variable is unset", () => {
    expect(() => requireEnv(VAR_NAME)).toThrow(`Missing required environment variable: ${VAR_NAME}`);
  });

  it("throws when the variable is set to an empty string", () => {
    process.env[VAR_NAME] = "";
    expect(() => requireEnv(VAR_NAME)).toThrow(`Missing required environment variable: ${VAR_NAME}`);
  });
});
