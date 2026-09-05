import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetModules();
});

const validSchemaResponse = { tables: [] };
const validJobRunsResponse = { jobRuns: [] };

describe("warehouseDataService (the exported singleton)", () => {
  it("returns mock data when VITE_DATA_MODE is unset", async () => {
    const { warehouseDataService } = await import("../../src/services/warehouseDataService");
    const { MOCK_WAREHOUSE_SCHEMA } = await import("../../src/test-data/warehouseSchema");
    const { MOCK_WAREHOUSE_JOB_RUNS } = await import("../../src/test-data/warehouseJobRuns");

    await expect(warehouseDataService.getSchema()).resolves.toEqual(MOCK_WAREHOUSE_SCHEMA);
    await expect(warehouseDataService.getJobRuns()).resolves.toEqual(MOCK_WAREHOUSE_JOB_RUNS);
  });

  it("still returns mock data even when VITE_DATA_MODE=live — no backend exists for these routes yet", async () => {
    vi.stubEnv("VITE_DATA_MODE", "live");
    vi.stubEnv("VITE_API_BASE_URL", "https://api.example.com");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("should never be called")));

    const { warehouseDataService } = await import("../../src/services/warehouseDataService");
    const { MOCK_WAREHOUSE_SCHEMA } = await import("../../src/test-data/warehouseSchema");

    await expect(warehouseDataService.getSchema()).resolves.toEqual(MOCK_WAREHOUSE_SCHEMA);
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe("LiveWarehouseDataService (the documented target contract, not yet wired up)", () => {
  it("getSchema fetches from config.apiBaseUrl + /data/schema and parses the response", async () => {
    vi.stubEnv("VITE_API_BASE_URL", "https://api.example.com");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => validSchemaResponse }));

    const { LiveWarehouseDataService } = await import("../../src/services/warehouseDataService");

    await expect(new LiveWarehouseDataService().getSchema()).resolves.toEqual(validSchemaResponse);
    expect(fetch).toHaveBeenCalledWith("https://api.example.com/data/schema");
  });

  it("getSchema throws a descriptive error when the response is not ok", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500 }));

    const { LiveWarehouseDataService } = await import("../../src/services/warehouseDataService");

    await expect(new LiveWarehouseDataService().getSchema()).rejects.toThrow("HTTP 500");
  });

  it("getSchema throws when the response body fails schema validation", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ not: "valid" }) }));

    const { LiveWarehouseDataService } = await import("../../src/services/warehouseDataService");

    await expect(new LiveWarehouseDataService().getSchema()).rejects.toThrow();
  });

  it("getJobRuns fetches from config.apiBaseUrl + /data/jobs and parses the response", async () => {
    vi.stubEnv("VITE_API_BASE_URL", "https://api.example.com");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => validJobRunsResponse }));

    const { LiveWarehouseDataService } = await import("../../src/services/warehouseDataService");

    await expect(new LiveWarehouseDataService().getJobRuns()).resolves.toEqual(validJobRunsResponse);
    expect(fetch).toHaveBeenCalledWith("https://api.example.com/data/jobs");
  });

  it("getJobRuns throws a descriptive error when the response is not ok", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 503 }));

    const { LiveWarehouseDataService } = await import("../../src/services/warehouseDataService");

    await expect(new LiveWarehouseDataService().getJobRuns()).rejects.toThrow("HTTP 503");
  });

  it("getJobRuns throws when the response body fails schema validation", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ not: "valid" }) }));

    const { LiveWarehouseDataService } = await import("../../src/services/warehouseDataService");

    await expect(new LiveWarehouseDataService().getJobRuns()).rejects.toThrow();
  });
});
