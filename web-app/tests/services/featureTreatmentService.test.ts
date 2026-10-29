import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe("featureTreatmentService — mock", () => {
  it("resolves a sample flag to its default, and a missing flag to null", async () => {
    vi.stubEnv("VITE_DATA_MODE", "mock");
    const { featureTreatmentService } = await import("../../src/services/featureTreatmentService");
    await expect(featureTreatmentService.getTreatment("MAP_V2")).resolves.toBe("T1");
    await expect(featureTreatmentService.getTreatment("NOPE")).resolves.toBeNull();
  });
});

describe("featureTreatmentService — live", () => {
  async function live(response: { ok: boolean; status: number; json?: () => Promise<unknown> }) {
    vi.stubEnv("VITE_DATA_MODE", "live");
    vi.stubEnv("VITE_API_BASE_URL", "https://api.example.com");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response));
    return (await import("../../src/services/featureTreatmentService")).featureTreatmentService;
  }

  it("POSTs an empty context to the public treatment route and returns the treatment", async () => {
    const service = await live({ ok: true, status: 200, json: async () => ({ flag_key: "CUSTOMERS_TAB", treatment: "C" }) });
    await expect(service.getTreatment("CUSTOMERS_TAB")).resolves.toBe("C");
    expect(fetch).toHaveBeenCalledWith("https://api.example.com/feature-flags/CUSTOMERS_TAB/treatment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ context: {} }),
    });
  });

  it("returns null when the flag does not exist", async () => {
    const service = await live({ ok: false, status: 404 });
    await expect(service.getTreatment("CUSTOMERS_TAB")).resolves.toBeNull();
  });

  it("throws on any other failure", async () => {
    const service = await live({ ok: false, status: 500 });
    await expect(service.getTreatment("CUSTOMERS_TAB")).rejects.toThrow("HTTP 500");
  });
});
