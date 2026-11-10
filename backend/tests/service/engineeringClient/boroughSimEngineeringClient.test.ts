import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ENGINEERING_QUERY_LIMIT_MAX, EngineeringClientConfigSchema } from "../../../models/engineeringClientConfig";
import { BoroughSimEngineeringClient } from "../../../service/engineeringClient/boroughSimEngineeringClient";

const NOW = new Date("2026-11-09T10:00:00.000Z");
const FRESH = `h.${Buffer.from(JSON.stringify({ exp: NOW.getTime() / 1000 + 3600 })).toString("base64url")}.s`;
const CONFIG = { BOROUGH_SIM_API_URL: "https://api.example.com", AGENT_ID_TOKEN: FRESH, AGENT_REFRESH_TOKEN: "r", AGENT_CLIENT_ID: "c", AGENT_REGION: "us-east-1" };

const json = (body: unknown, status = 200) => new Response(body === null ? null : JSON.stringify(body), { status });

let fetchMock: ReturnType<typeof vi.fn>;
const client = (config = CONFIG) => new BoroughSimEngineeringClient(config, { fetch: fetchMock as unknown as typeof fetch, now: () => NOW });
const calls = () => (fetchMock.mock.calls as [string, RequestInit][]).map(([url, init]) => `${init.method} ${url}`);

beforeEach(() => {
  fetchMock = vi.fn(async () => json({ ok: true }));
  vi.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("BoroughSimEngineeringClient", () => {
  it("runs a query with the agent's token, reporting the budget left", async () => {
    fetchMock.mockResolvedValueOnce(json({ rows: [{ n: "1" }] }));
    expect(await client().runQuery("SELECT 1")).toEqual({ status: 200, body: { rows: [{ n: "1" }], queries_remaining: ENGINEERING_QUERY_LIMIT_MAX - 1 } });
    const [url, init] = (fetchMock.mock.calls as [string, RequestInit][])[0];
    expect(`${init.method} ${url}`).toBe("POST https://api.example.com/admin/warehouse/query");
    expect(JSON.parse(String(init.body))).toEqual({ sql: "SELECT 1" });
    expect((init.headers as Record<string, string>).Authorization).toBe(`Bearer ${FRESH}`);
  });

  it("holds a run to the budget it sets, sending nothing past it", async () => {
    const c = client({ ...CONFIG, ENGINEERING_QUERY_LIMIT: 1 } as typeof CONFIG);
    expect((await c.runQuery("SELECT 1")).body).toMatchObject({ queries_remaining: 0 });
    expect((await c.runQuery("SELECT 2")).status).toBe(429);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("reads one flag by its encoded key, passing failures through", async () => {
    fetchMock.mockResolvedValueOnce(json({ flag_key: "BACKEND_FLAG_READS", default_treatment: "C" }));
    expect(await client().getFlag("BACKEND_FLAG_READS")).toEqual({ status: 200, body: { flag_key: "BACKEND_FLAG_READS", default_treatment: "C" } });
    fetchMock.mockResolvedValueOnce(json(null, 404));
    expect(await client().getFlag("A B")).toEqual({ status: 404, body: null });
    expect(calls()).toEqual(["GET https://api.example.com/feature-flags/BACKEND_FLAG_READS", "GET https://api.example.com/feature-flags/A%20B"]);
  });

  it("reads the run's query budget from the environment, never above the cap", () => {
    const env = { BOROUGH_SIM_API_URL: "https://api.example.com", AGENT_ID_TOKEN: "a", AGENT_REFRESH_TOKEN: "b", AGENT_CLIENT_ID: "c", AGENT_REGION: "us-east-1" };
    expect(EngineeringClientConfigSchema.parse(env).ENGINEERING_QUERY_LIMIT).toBeUndefined();
    expect(EngineeringClientConfigSchema.parse({ ...env, ENGINEERING_QUERY_LIMIT: "3" }).ENGINEERING_QUERY_LIMIT).toBe(3);
    expect(() => EngineeringClientConfigSchema.parse({ ...env, ENGINEERING_QUERY_LIMIT: "11" })).toThrow();
  });

  it("uses the real fetch by default", () => {
    expect(new BoroughSimEngineeringClient(CONFIG)).toBeInstanceOf(BoroughSimEngineeringClient);
  });
});
