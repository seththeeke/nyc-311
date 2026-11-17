import { describe, expect, it } from "vitest";
import { RuntimeEnvConfigSchema } from "../../src/models/runtimeEnvConfig";

describe("RuntimeEnvConfigSchema", () => {
  it("accepts every field WebsiteDeployment writes and drops unknown keys", () => {
    const parsed = RuntimeEnvConfigSchema.parse({
      apiBaseUrl: "https://api.example.com",
      publicApiBaseUrl: "https://public-api.example.com",
      chatApiBaseUrl: "https://chat-api.example.com",
      userPoolId: "us-east-1_abc",
      userPoolClientId: "client-abc",
      extra: "ignored",
    });
    expect(parsed).toEqual({
      apiBaseUrl: "https://api.example.com",
      publicApiBaseUrl: "https://public-api.example.com",
      chatApiBaseUrl: "https://chat-api.example.com",
      userPoolId: "us-east-1_abc",
      userPoolClientId: "client-abc",
    });
  });

  it("reads an empty string as unset", () => {
    expect(RuntimeEnvConfigSchema.parse({ apiBaseUrl: "" }).apiBaseUrl).toBeUndefined();
  });

  it("accepts an empty object", () => {
    expect(RuntimeEnvConfigSchema.safeParse({}).success).toBe(true);
  });

  it("rejects a non-string field", () => {
    expect(RuntimeEnvConfigSchema.safeParse({ chatApiBaseUrl: 42 }).success).toBe(false);
  });

  it("rejects a non-object body", () => {
    expect(RuntimeEnvConfigSchema.safeParse("<!doctype html>").success).toBe(false);
  });
});
