import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchAuthSession } from "aws-amplify/auth";

vi.mock("aws-amplify", () => ({ Amplify: { configure: vi.fn() } }));
vi.mock("aws-amplify/auth", () => ({ fetchAuthSession: vi.fn() }));

const mockedFetchAuthSession = vi.mocked(fetchAuthSession);

beforeEach(() => {
  mockedFetchAuthSession.mockReset();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe("warehouseJobRunResultsService — mock mode", () => {
  it("returns a result item for a job_run_id with a baked fixture", async () => {
    vi.stubEnv("VITE_DATA_MODE", "mock");
    const { warehouseJobRunResultsService } = await import("../../src/services/warehouseJobRunResultsService");
    const { MOCK_JOB_RUN_RESULTS } = await import("../../src/test-data/jobRunResults");

    const results = await warehouseJobRunResultsService.getJobRunResults(["01J8Z2SUCCEEDED000000000002"]);

    expect(results).toEqual([
      { job_run_id: "01J8Z2SUCCEEDED000000000002", result: MOCK_JOB_RUN_RESULTS["01J8Z2SUCCEEDED000000000002"], error: null },
    ]);
  });

  it("returns a per-item error for an id with no fixture, without throwing", async () => {
    vi.stubEnv("VITE_DATA_MODE", "mock");
    const { warehouseJobRunResultsService } = await import("../../src/services/warehouseJobRunResultsService");

    const results = await warehouseJobRunResultsService.getJobRunResults(["01UNKNOWN"]);

    expect(results).toEqual([{ job_run_id: "01UNKNOWN", result: null, error: "No result for this job run" }]);
  });

  it("resolves multiple ids independently in one call", async () => {
    vi.stubEnv("VITE_DATA_MODE", "mock");
    const { warehouseJobRunResultsService } = await import("../../src/services/warehouseJobRunResultsService");

    const results = await warehouseJobRunResultsService.getJobRunResults(["01J8Z2SUCCEEDED000000000002", "01UNKNOWN"]);

    expect(results).toHaveLength(2);
    expect(results[0].error).toBeNull();
    expect(results[1].error).toBe("No result for this job run");
  });
});

describe("warehouseJobRunResultsService — live mode", () => {
  it("POSTs the job_run_ids and parses the results array", async () => {
    vi.stubEnv("VITE_DATA_MODE", "live");
    vi.stubEnv("VITE_API_BASE_URL", "https://api.example.com");
    mockedFetchAuthSession.mockResolvedValue({ tokens: { idToken: { toString: () => "id-token-value" } } } as never);
    const responseBody = { results: [{ job_run_id: "01A", result: null, error: "No result for this job run" }] };
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => responseBody });
    vi.stubGlobal("fetch", fetchMock);

    const { warehouseJobRunResultsService } = await import("../../src/services/warehouseJobRunResultsService");
    const results = await warehouseJobRunResultsService.getJobRunResults(["01A"]);

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.example.com/admin/warehouse/job-runs/results",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: "Bearer id-token-value" }),
        body: JSON.stringify({ job_run_ids: ["01A"] }),
      })
    );
    expect(results).toEqual(responseBody.results);
  });

  it("throws a descriptive error on a non-2xx response with no body", async () => {
    vi.stubEnv("VITE_DATA_MODE", "live");
    mockedFetchAuthSession.mockResolvedValue({ tokens: { idToken: { toString: () => "id-token-value" } } } as never);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 500, json: () => Promise.reject(new Error("no body")) })
    );

    const { warehouseJobRunResultsService } = await import("../../src/services/warehouseJobRunResultsService");

    await expect(warehouseJobRunResultsService.getJobRunResults(["01A"])).rejects.toThrow(
      "Failed to load job run results: HTTP 500"
    );
  });

  it("surfaces the server's error message on a non-2xx response", async () => {
    vi.stubEnv("VITE_DATA_MODE", "live");
    mockedFetchAuthSession.mockResolvedValue({ tokens: { idToken: { toString: () => "id-token-value" } } } as never);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 400, json: async () => ({ message: "Malformed request body" }) })
    );

    const { warehouseJobRunResultsService } = await import("../../src/services/warehouseJobRunResultsService");

    await expect(warehouseJobRunResultsService.getJobRunResults(["01A"])).rejects.toThrow("Malformed request body");
  });

  it("throws not authenticated when there's no idToken", async () => {
    vi.stubEnv("VITE_DATA_MODE", "live");
    mockedFetchAuthSession.mockResolvedValue({ tokens: {} } as never);

    const { warehouseJobRunResultsService } = await import("../../src/services/warehouseJobRunResultsService");

    await expect(warehouseJobRunResultsService.getJobRunResults(["01A"])).rejects.toThrow("Not authenticated");
  });

  it("throws when the response body fails schema validation", async () => {
    vi.stubEnv("VITE_DATA_MODE", "live");
    mockedFetchAuthSession.mockResolvedValue({ tokens: { idToken: { toString: () => "id-token-value" } } } as never);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ not: "the expected shape" }) }));

    const { warehouseJobRunResultsService } = await import("../../src/services/warehouseJobRunResultsService");

    await expect(warehouseJobRunResultsService.getJobRunResults(["01A"])).rejects.toThrow();
  });
});
