import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchAuthSession } from "aws-amplify/auth";

vi.mock("aws-amplify", () => ({ Amplify: { configure: vi.fn() } }));
vi.mock("aws-amplify/auth", () => ({ fetchAuthSession: vi.fn() }));

const mockedFetchAuthSession = vi.mocked(fetchAuthSession);

function signedIn(): void {
  mockedFetchAuthSession.mockResolvedValue({ tokens: { idToken: { toString: () => "id-token" } } } as Awaited<
    ReturnType<typeof fetchAuthSession>
  >);
}

beforeEach(() => {
  mockedFetchAuthSession.mockReset();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetModules();
});

const validSchemaResponse = { tables: [] };
const validJobRunsResponse = { jobRuns: [] };

describe("warehouseDataService (the exported singleton)", () => {
  it("returns mock data when the data mode is not live", async () => {
    vi.stubEnv("VITE_DATA_MODE", "mock");
    const { warehouseDataService } = await import("../../src/services/warehouseDataService");
    const { MOCK_WAREHOUSE_SCHEMA } = await import("../../src/test-data/warehouseSchema");
    const { MOCK_WAREHOUSE_JOB_RUNS } = await import("../../src/test-data/warehouseJobRuns");

    await expect(warehouseDataService.getSchema()).resolves.toEqual(MOCK_WAREHOUSE_SCHEMA);
    await expect(warehouseDataService.getJobRuns()).resolves.toEqual(MOCK_WAREHOUSE_JOB_RUNS);
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

  it("getJobRuns fetches the admin route /admin/warehouse/job-runs with the ID token, and parses the response", async () => {
    vi.stubEnv("VITE_API_BASE_URL", "https://api.example.com");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => validJobRunsResponse }));
    signedIn();

    const { LiveWarehouseDataService } = await import("../../src/services/warehouseDataService");

    await expect(new LiveWarehouseDataService().getJobRuns()).resolves.toEqual(validJobRunsResponse);
    expect(fetch).toHaveBeenCalledWith("https://api.example.com/admin/warehouse/job-runs", {
      headers: { Authorization: "Bearer id-token" },
    });
  });

  it("getJobRuns throws without fetching when there's no signed-in session", async () => {
    vi.stubGlobal("fetch", vi.fn());
    mockedFetchAuthSession.mockResolvedValue({ tokens: undefined } as Awaited<ReturnType<typeof fetchAuthSession>>);

    const { LiveWarehouseDataService } = await import("../../src/services/warehouseDataService");

    await expect(new LiveWarehouseDataService().getJobRuns()).rejects.toThrow("Not authenticated");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("getJobRuns throws a descriptive error when the response is not ok", async () => {
    signedIn();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 503 }));

    const { LiveWarehouseDataService } = await import("../../src/services/warehouseDataService");

    await expect(new LiveWarehouseDataService().getJobRuns()).rejects.toThrow("HTTP 503");
  });

  it("getJobRuns throws when the response body fails schema validation", async () => {
    signedIn();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ not: "valid" }) }));

    const { LiveWarehouseDataService } = await import("../../src/services/warehouseDataService");

    await expect(new LiveWarehouseDataService().getJobRuns()).rejects.toThrow();
  });



});
