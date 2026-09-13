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

describe("warehouseJobDefinitionService — mock mode", () => {
  it("listJobs returns the baked mock job definitions", async () => {
    vi.stubEnv("VITE_DATA_MODE", "mock");
    const { warehouseJobDefinitionService } = await import("../../src/services/warehouseJobDefinitionService");
    const { MOCK_WAREHOUSE_JOB_DEFINITIONS } = await import("../../src/test-data/warehouseJobDefinitions");

    const jobs = await warehouseJobDefinitionService.listJobs();

    expect(jobs).toEqual(MOCK_WAREHOUSE_JOB_DEFINITIONS.jobs);
  });

  it("createJob appends a new definition, reflected in the next list", async () => {
    vi.stubEnv("VITE_DATA_MODE", "mock");
    const { warehouseJobDefinitionService } = await import("../../src/services/warehouseJobDefinitionService");
    const { MOCK_WAREHOUSE_JOB_DEFINITIONS } = await import("../../src/test-data/warehouseJobDefinitions");

    const created = await warehouseJobDefinitionService.createJob("order_volume_by_zip", "cron(0 9 * * ? *)", "SELECT 1");

    expect(created.job_name).toBe("order_volume_by_zip");
    expect(created.cadence_cron).toBe("cron(0 9 * * ? *)");
    expect(created.record_type).toBe("DEFINITION");

    const jobs = await warehouseJobDefinitionService.listJobs();
    expect(jobs).toHaveLength(MOCK_WAREHOUSE_JOB_DEFINITIONS.jobs.length + 1);
  });

  it("createJob rejects a name that doesn't match the naming regex", async () => {
    vi.stubEnv("VITE_DATA_MODE", "mock");
    const { warehouseJobDefinitionService } = await import("../../src/services/warehouseJobDefinitionService");

    await expect(warehouseJobDefinitionService.createJob("Order Volume", "cron(0 9 * * ? *)", "SELECT 1")).rejects.toThrow(
      "lowercase letters, digits, and underscores only"
    );
  });

  it("createJob rejects blank SQL", async () => {
    vi.stubEnv("VITE_DATA_MODE", "mock");
    const { warehouseJobDefinitionService } = await import("../../src/services/warehouseJobDefinitionService");

    await expect(warehouseJobDefinitionService.createJob("order_volume_by_zip", "cron(0 9 * * ? *)", "   ")).rejects.toThrow(
      "SQL is required"
    );
  });

  it("createJob rejects a name collision", async () => {
    vi.stubEnv("VITE_DATA_MODE", "mock");
    const { warehouseJobDefinitionService } = await import("../../src/services/warehouseJobDefinitionService");
    const { MOCK_WAREHOUSE_JOB_DEFINITIONS } = await import("../../src/test-data/warehouseJobDefinitions");
    const existingName = MOCK_WAREHOUSE_JOB_DEFINITIONS.jobs[0].job_name;

    await expect(warehouseJobDefinitionService.createJob(existingName, "cron(0 9 * * ? *)", "SELECT 1")).rejects.toThrow(
      "already exists"
    );
  });

  it("deleteJob removes the definition from the next list", async () => {
    vi.stubEnv("VITE_DATA_MODE", "mock");
    const { warehouseJobDefinitionService } = await import("../../src/services/warehouseJobDefinitionService");
    const { MOCK_WAREHOUSE_JOB_DEFINITIONS } = await import("../../src/test-data/warehouseJobDefinitions");
    const existingName = MOCK_WAREHOUSE_JOB_DEFINITIONS.jobs[0].job_name;

    await warehouseJobDefinitionService.deleteJob(existingName);

    const jobs = await warehouseJobDefinitionService.listJobs();
    expect(jobs.find((job) => job.job_name === existingName)).toBeUndefined();
  });

  it("deleteJob throws for an unknown job name", async () => {
    vi.stubEnv("VITE_DATA_MODE", "mock");
    const { warehouseJobDefinitionService } = await import("../../src/services/warehouseJobDefinitionService");

    await expect(warehouseJobDefinitionService.deleteJob("no_such_job")).rejects.toThrow("No job named");
  });
});

describe("warehouseJobDefinitionService — live mode", () => {
  it("listJobs fetches with the bearer token and parses the response", async () => {
    vi.stubEnv("VITE_DATA_MODE", "live");
    vi.stubEnv("VITE_API_BASE_URL", "https://api.example.com");
    mockedFetchAuthSession.mockResolvedValue({ tokens: { idToken: { toString: () => "id-token-value" } } } as never);
    const listBody = { jobs: [] };
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => listBody });
    vi.stubGlobal("fetch", fetchMock);

    const { warehouseJobDefinitionService } = await import("../../src/services/warehouseJobDefinitionService");
    const jobs = await warehouseJobDefinitionService.listJobs();

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.example.com/admin/warehouse/jobs",
      expect.objectContaining({ headers: { Authorization: "Bearer id-token-value" } })
    );
    expect(jobs).toEqual([]);
  });

  it("listJobs throws a descriptive error on a non-2xx response with no body", async () => {
    vi.stubEnv("VITE_DATA_MODE", "live");
    mockedFetchAuthSession.mockResolvedValue({ tokens: { idToken: { toString: () => "id-token-value" } } } as never);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 500, json: () => Promise.reject(new Error("no body")) })
    );

    const { warehouseJobDefinitionService } = await import("../../src/services/warehouseJobDefinitionService");

    await expect(warehouseJobDefinitionService.listJobs()).rejects.toThrow("Failed to list jobs: HTTP 500");
  });

  it("listJobs throws not authenticated when there's no idToken", async () => {
    vi.stubEnv("VITE_DATA_MODE", "live");
    mockedFetchAuthSession.mockResolvedValue({ tokens: {} } as never);

    const { warehouseJobDefinitionService } = await import("../../src/services/warehouseJobDefinitionService");

    await expect(warehouseJobDefinitionService.listJobs()).rejects.toThrow("Not authenticated");
  });

  it("createJob POSTs the name/cadence/sql and parses the created definition", async () => {
    vi.stubEnv("VITE_DATA_MODE", "live");
    vi.stubEnv("VITE_API_BASE_URL", "https://api.example.com");
    mockedFetchAuthSession.mockResolvedValue({ tokens: { idToken: { toString: () => "id-token-value" } } } as never);
    const definitionBody = {
      job_run_id: "DEF#order_volume_by_zip",
      record_type: "DEFINITION",
      job_name: "order_volume_by_zip",
      sql_s3_key: "job-definitions/order_volume_by_zip.sql",
      cadence_cron: "cron(0 9 * * ? *)",
      schedule_name: "Nyc311WarehouseJob-order_volume_by_zip-Test",
      created_at: "2026-09-13T19:04:11.000Z",
      created_by: "01ADMIN0000000000000000001",
    };
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => definitionBody });
    vi.stubGlobal("fetch", fetchMock);

    const { warehouseJobDefinitionService } = await import("../../src/services/warehouseJobDefinitionService");
    const result = await warehouseJobDefinitionService.createJob("order_volume_by_zip", "cron(0 9 * * ? *)", "SELECT 1");

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.example.com/admin/warehouse/jobs",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: "Bearer id-token-value" }),
        body: JSON.stringify({ name: "order_volume_by_zip", cadence_cron: "cron(0 9 * * ? *)", sql: "SELECT 1" }),
      })
    );
    expect(result).toEqual(definitionBody);
  });

  it("createJob surfaces the server's error message on a non-2xx response", async () => {
    vi.stubEnv("VITE_DATA_MODE", "live");
    mockedFetchAuthSession.mockResolvedValue({ tokens: { idToken: { toString: () => "id-token-value" } } } as never);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 409, json: async () => ({ message: 'A job named "x" already exists' }) })
    );

    const { warehouseJobDefinitionService } = await import("../../src/services/warehouseJobDefinitionService");

    await expect(warehouseJobDefinitionService.createJob("x", "cron(0 9 * * ? *)", "SELECT 1")).rejects.toThrow(
      'A job named "x" already exists'
    );
  });

  it("deleteJob DELETEs the encoded job name path", async () => {
    vi.stubEnv("VITE_DATA_MODE", "live");
    vi.stubEnv("VITE_API_BASE_URL", "https://api.example.com");
    mockedFetchAuthSession.mockResolvedValue({ tokens: { idToken: { toString: () => "id-token-value" } } } as never);
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    vi.stubGlobal("fetch", fetchMock);

    const { warehouseJobDefinitionService } = await import("../../src/services/warehouseJobDefinitionService");
    await warehouseJobDefinitionService.deleteJob("order volume");

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.example.com/admin/warehouse/jobs/order%20volume",
      expect.objectContaining({ method: "DELETE" })
    );
  });

  it("deleteJob throws a descriptive error on a non-2xx response", async () => {
    vi.stubEnv("VITE_DATA_MODE", "live");
    mockedFetchAuthSession.mockResolvedValue({ tokens: { idToken: { toString: () => "id-token-value" } } } as never);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 404, json: () => Promise.reject(new Error("no body")) })
    );

    const { warehouseJobDefinitionService } = await import("../../src/services/warehouseJobDefinitionService");

    await expect(warehouseJobDefinitionService.deleteJob("no_such_job")).rejects.toThrow("Failed to delete job: HTTP 404");
  });
});
