import { afterEach, describe, expect, it, vi } from "vitest";
import { MOCK_PUBLIC_API_SPEC } from "../../src/test-data/publicApiSpec";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe("publicApiSpecService", () => {
  it("mock mode returns the sample spec", async () => {
    vi.stubEnv("VITE_DATA_MODE", "mock");
    const { publicApiSpecService } = await import("../../src/services/publicApiSpecService");
    await expect(publicApiSpecService.getSpecYaml()).resolves.toBe(MOCK_PUBLIC_API_SPEC);
  });

  it("live mode fetches the spec from the public API, naming itself as requester", async () => {
    vi.stubEnv("VITE_DATA_MODE", "live");
    vi.stubEnv("VITE_PUBLIC_API_BASE_URL", "https://public-api.example.com");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, text: async () => "openapi: 3.1.0" }));
    const { publicApiSpecService } = await import("../../src/services/publicApiSpecService");
    await expect(publicApiSpecService.getSpecYaml()).resolves.toBe("openapi: 3.1.0");
    expect(fetch).toHaveBeenCalledWith("https://public-api.example.com/v1/openapi.yaml", { headers: { "X-Requester": "web-app:docs" } });
  });

  it("live mode throws on a failed response", async () => {
    vi.stubEnv("VITE_DATA_MODE", "live");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 400 }));
    const { publicApiSpecService } = await import("../../src/services/publicApiSpecService");
    await expect(publicApiSpecService.getSpecYaml()).rejects.toThrow("HTTP 400");
  });
});
