import { afterEach, describe, expect, it, vi } from "vitest";

describe("config", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("defaults to mock data mode and empty apiBaseUrl when env vars are unset", async () => {
    const { config } = await import("../src/config");
    expect(config.dataMode).toBe("mock");
    expect(config.apiBaseUrl).toBe("");
  });

  it("resolves to live data mode and the configured apiBaseUrl when set", async () => {
    vi.stubEnv("VITE_DATA_MODE", "live");
    vi.stubEnv("VITE_API_BASE_URL", "https://api.example.com");
    const { config } = await import("../src/config");
    expect(config.dataMode).toBe("live");
    expect(config.apiBaseUrl).toBe("https://api.example.com");
  });

  it("falls back to mock for any non-live VITE_DATA_MODE value", async () => {
    vi.stubEnv("VITE_DATA_MODE", "bogus");
    const { config } = await import("../src/config");
    expect(config.dataMode).toBe("mock");
  });
});
