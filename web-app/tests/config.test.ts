import { afterEach, describe, expect, it, vi } from "vitest";

describe("config", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("defaults to mock data mode and empty apiBaseUrl/pipelineApiBaseUrl when env vars are unset", async () => {
    /*
     * Stubbed explicitly rather than relying on ambient absence — a
     * developer's local .env.local (e.g. for pointing local dev at a real
     * deployed API) — or web-app/.env's own checked-in
     * VITE_PIPELINE_API_BASE_URL= — would otherwise silently break this
     * test's premise.
     */
    vi.stubEnv("VITE_DATA_MODE", "");
    vi.stubEnv("VITE_API_BASE_URL", "");
    vi.stubEnv("VITE_PIPELINE_API_BASE_URL", "");
    const { config } = await import("../src/config");
    expect(config.dataMode).toBe("mock");
    expect(config.apiBaseUrl).toBe("");
    expect(config.pipelineApiBaseUrl).toBe("");
  });

  it("resolves to live data mode and the configured apiBaseUrl/pipelineApiBaseUrl when set", async () => {
    vi.stubEnv("VITE_DATA_MODE", "live");
    vi.stubEnv("VITE_API_BASE_URL", "https://api.example.com");
    vi.stubEnv("VITE_PIPELINE_API_BASE_URL", "https://pipeline-api.example.com");
    const { config } = await import("../src/config");
    expect(config.dataMode).toBe("live");
    expect(config.apiBaseUrl).toBe("https://api.example.com");
    expect(config.pipelineApiBaseUrl).toBe("https://pipeline-api.example.com");
  });

  it("falls back to mock for any non-live VITE_DATA_MODE value", async () => {
    vi.stubEnv("VITE_DATA_MODE", "bogus");
    const { config } = await import("../src/config");
    expect(config.dataMode).toBe("mock");
  });
});

describe("loadRuntimeConfig", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("overwrites apiBaseUrl in place from /env-config.json when present", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ apiBaseUrl: "https://deployed.example.com" }),
      })
    );
    const { config, loadRuntimeConfig } = await import("../src/config");

    await loadRuntimeConfig();

    expect(config.apiBaseUrl).toBe("https://deployed.example.com");
    expect(fetch).toHaveBeenCalledWith("/env-config.json");
  });

  it("keeps the Vite-build-time default when the fetch 404s (local dev)", async () => {
    vi.stubEnv("VITE_API_BASE_URL", "https://local-default.example.com");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
    const { config, loadRuntimeConfig } = await import("../src/config");

    await loadRuntimeConfig();

    expect(config.apiBaseUrl).toBe("https://local-default.example.com");
  });

  it("keeps the Vite-build-time default when the fetch itself throws (network error)", async () => {
    vi.stubEnv("VITE_API_BASE_URL", "https://local-default.example.com");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));
    const { config, loadRuntimeConfig } = await import("../src/config");

    await loadRuntimeConfig();

    expect(config.apiBaseUrl).toBe("https://local-default.example.com");
  });

  it("ignores a runtime config payload with no usable apiBaseUrl", async () => {
    vi.stubEnv("VITE_API_BASE_URL", "https://local-default.example.com");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }));
    const { config, loadRuntimeConfig } = await import("../src/config");

    await loadRuntimeConfig();

    expect(config.apiBaseUrl).toBe("https://local-default.example.com");
  });
});
