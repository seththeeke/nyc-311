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

describe("warehouseQueryService — mock mode", () => {
  it("returns the canned resultset for a SELECT", async () => {
    vi.stubEnv("VITE_DATA_MODE", "mock");
    const { warehouseQueryService } = await import("../../src/services/warehouseQueryService");

    const result = await warehouseQueryService.runQuery("SELECT * FROM locations");

    expect(result.row_count).toBeGreaterThan(0);
  });

  it("rejects a non-read-only statement without hitting the network", async () => {
    vi.stubEnv("VITE_DATA_MODE", "mock");
    const { warehouseQueryService } = await import("../../src/services/warehouseQueryService");

    await expect(warehouseQueryService.runQuery("DELETE FROM order_events")).rejects.toThrow(
      "Only SELECT/WITH/SHOW/DESCRIBE/EXPLAIN statements are allowed"
    );
  });

  it("accepts WITH/SHOW/DESCRIBE/EXPLAIN as read-only too", async () => {
    vi.stubEnv("VITE_DATA_MODE", "mock");
    const { warehouseQueryService } = await import("../../src/services/warehouseQueryService");

    for (const sql of ["WITH a AS (SELECT 1) SELECT * FROM a", "SHOW TABLES", "DESCRIBE locations", "EXPLAIN SELECT 1"]) {
      await expect(warehouseQueryService.runQuery(sql)).resolves.toBeDefined();
    }
  });
});

describe("warehouseQueryService — live mode", () => {
  it("POSTs /admin/warehouse/query with the bearer token and parses the response", async () => {
    vi.stubEnv("VITE_DATA_MODE", "live");
    vi.stubEnv("VITE_API_BASE_URL", "https://api.example.com");
    mockedFetchAuthSession.mockResolvedValue({
      tokens: { idToken: { toString: () => "id-token-value" } },
    } as never);
    const body = {
      columns: [{ name: "n", type: "bigint" }],
      rows: [{ n: "1" }],
      row_count: 1,
      truncated: false,
      data_scanned_bytes: 10,
      engine_execution_time_ms: 5,
    };
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(body) });
    vi.stubGlobal("fetch", fetchMock);

    const { warehouseQueryService } = await import("../../src/services/warehouseQueryService");
    const result = await warehouseQueryService.runQuery("SELECT 1");

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.example.com/admin/warehouse/query",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: "Bearer id-token-value" }),
        body: JSON.stringify({ sql: "SELECT 1" }),
      })
    );
    expect(result).toEqual(body);
  });

  it("throws when not authenticated (no idToken)", async () => {
    vi.stubEnv("VITE_DATA_MODE", "live");
    mockedFetchAuthSession.mockResolvedValue({ tokens: {} } as never);

    const { warehouseQueryService } = await import("../../src/services/warehouseQueryService");

    await expect(warehouseQueryService.runQuery("SELECT 1")).rejects.toThrow("Not authenticated");
  });

  it("surfaces the response body's message on a non-2xx response", async () => {
    vi.stubEnv("VITE_DATA_MODE", "live");
    mockedFetchAuthSession.mockResolvedValue({ tokens: { idToken: { toString: () => "id-token-value" } } } as never);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 400, json: () => Promise.resolve({ message: "Not read-only" }) })
    );

    const { warehouseQueryService } = await import("../../src/services/warehouseQueryService");

    await expect(warehouseQueryService.runQuery("DELETE FROM x")).rejects.toThrow("Not read-only");
  });

  it("falls back to a generic HTTP-status message when the error body isn't JSON", async () => {
    vi.stubEnv("VITE_DATA_MODE", "live");
    mockedFetchAuthSession.mockResolvedValue({ tokens: { idToken: { toString: () => "id-token-value" } } } as never);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 500, json: () => Promise.reject(new Error("not json")) })
    );

    const { warehouseQueryService } = await import("../../src/services/warehouseQueryService");

    await expect(warehouseQueryService.runQuery("SELECT 1")).rejects.toThrow("Failed to run query: HTTP 500");
  });
});
