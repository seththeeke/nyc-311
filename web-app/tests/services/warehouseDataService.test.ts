import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetModules();
});

const validSchemaResponse = { tables: [] };
const validJobRunsResponse = { jobRuns: [] };
const validRollupsResponse = { rollups: [] };

describe("warehouseDataService (the exported singleton)", () => {
  it("returns mock data when the data mode is not live", async () => {
    vi.stubEnv("VITE_DATA_MODE", "mock");
    const { warehouseDataService } = await import("../../src/services/warehouseDataService");
    const { MOCK_WAREHOUSE_SCHEMA } = await import("../../src/test-data/warehouseSchema");
    const { MOCK_WAREHOUSE_JOB_RUNS } = await import("../../src/test-data/warehouseJobRuns");
    const { MOCK_ANALYTICS_ROLLUPS } = await import("../../src/test-data/analyticsRollups");

    await expect(warehouseDataService.getSchema()).resolves.toEqual(MOCK_WAREHOUSE_SCHEMA);
    await expect(warehouseDataService.getJobRuns()).resolves.toEqual(MOCK_WAREHOUSE_JOB_RUNS);
    await expect(warehouseDataService.getRollups()).resolves.toEqual(MOCK_ANALYTICS_ROLLUPS);
  });

  it("uses LiveWarehouseDataService when VITE_DATA_MODE=live", async () => {
    vi.stubEnv("VITE_DATA_MODE", "live");
    vi.stubEnv("VITE_API_BASE_URL", "https://api.example.com");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => validSchemaResponse }));

    const { warehouseDataService } = await import("../../src/services/warehouseDataService");

    await expect(warehouseDataService.getSchema()).resolves.toEqual(validSchemaResponse);
    expect(fetch).toHaveBeenCalledWith("https://api.example.com/data/schema");
  });
});

describe("LiveWarehouseDataService", () => {
  it("getSchema fetches config.apiBaseUrl + /data/schema and parses the response", async () => {
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

  it("getJobRuns fetches config.apiBaseUrl + /data/jobs and parses the response", async () => {
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

  it("getRollups fetches config.apiBaseUrl + /data/rollups and parses the response", async () => {
    vi.stubEnv("VITE_API_BASE_URL", "https://api.example.com");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => validRollupsResponse }));

    const { LiveWarehouseDataService } = await import("../../src/services/warehouseDataService");

    await expect(new LiveWarehouseDataService().getRollups()).resolves.toEqual(validRollupsResponse);
    expect(fetch).toHaveBeenCalledWith("https://api.example.com/data/rollups");
  });

  it("getRollups throws a descriptive error when the response is not ok", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500 }));

    const { LiveWarehouseDataService } = await import("../../src/services/warehouseDataService");

    await expect(new LiveWarehouseDataService().getRollups()).rejects.toThrow("HTTP 500");
  });

  it("getRollups throws when the response body fails schema validation", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ not: "valid" }) }));

    const { LiveWarehouseDataService } = await import("../../src/services/warehouseDataService");

    await expect(new LiveWarehouseDataService().getRollups()).rejects.toThrow();
  });
});
