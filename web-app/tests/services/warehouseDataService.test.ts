import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetModules();
});

const validSchemaResponse = { tables: [] };
const validJobRunsResponse = { jobRuns: [] };
const validJobResult = {
  job_name: "order_volume_by_stage_7d",
  job_run_id: "01RUN",
  run_date: "2026-09-07",
  computed_at: "2026-09-07T14:16:36.410Z",
  columns: [{ name: "stage", type: "varchar" }],
  rows: [{ stage: "SCHEDULE" }],
};

describe("warehouseDataService (the exported singleton)", () => {
  it("returns mock data when the data mode is not live", async () => {
    vi.stubEnv("VITE_DATA_MODE", "mock");
    const { warehouseDataService } = await import("../../src/services/warehouseDataService");
    const { MOCK_WAREHOUSE_SCHEMA } = await import("../../src/test-data/warehouseSchema");
    const { MOCK_WAREHOUSE_JOB_RUNS } = await import("../../src/test-data/warehouseJobRuns");
    const { MOCK_JOB_RESULTS } = await import("../../src/test-data/jobResult");

    await expect(warehouseDataService.getSchema()).resolves.toEqual(MOCK_WAREHOUSE_SCHEMA);
    await expect(warehouseDataService.getJobRuns()).resolves.toEqual(MOCK_WAREHOUSE_JOB_RUNS);
    await expect(warehouseDataService.getJobResult("order_volume_by_stage_7d")).resolves.toEqual(
      MOCK_JOB_RESULTS["order_volume_by_stage_7d"]
    );
    await expect(warehouseDataService.getJobResult("no_such_job")).rejects.toThrow("HTTP 404");
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

  it("getJobResult fetches config.apiBaseUrl + /data/jobs/<name>/result (name encoded) and parses the response", async () => {
    vi.stubEnv("VITE_API_BASE_URL", "https://api.example.com");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => validJobResult }));

    const { LiveWarehouseDataService } = await import("../../src/services/warehouseDataService");

    await expect(new LiveWarehouseDataService().getJobResult("order_volume_by_stage_7d")).resolves.toEqual(
      validJobResult
    );
    expect(fetch).toHaveBeenCalledWith("https://api.example.com/data/jobs/order_volume_by_stage_7d/result");
  });

  it("getJobResult throws a descriptive error when the response is not ok", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 404 }));

    const { LiveWarehouseDataService } = await import("../../src/services/warehouseDataService");

    await expect(new LiveWarehouseDataService().getJobResult("job_x")).rejects.toThrow("job_x': HTTP 404");
  });

  it("getJobResult throws when the response body fails envelope validation", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ not: "valid" }) }));

    const { LiveWarehouseDataService } = await import("../../src/services/warehouseDataService");

    await expect(new LiveWarehouseDataService().getJobResult("job_x")).rejects.toThrow();
  });
});
