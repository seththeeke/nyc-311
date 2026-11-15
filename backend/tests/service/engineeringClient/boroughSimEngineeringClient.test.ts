import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ENGINEERING_QUERY_LIMIT_MAX, EngineeringClientConfigSchema, type EngineeringClientConfig } from "../../../models/engineeringClientConfig";
import { BoroughSimEngineeringClient } from "../../../service/engineeringClient/boroughSimEngineeringClient";

const NOW = new Date("2026-11-09T10:00:00.000Z");
const token = (name: string) => `h.${Buffer.from(JSON.stringify({ exp: NOW.getTime() / 1000 + 3600, name })).toString("base64url")}.s`;
const PROD_TOKEN = token("prod");
const TEST_TOKEN = token("test");
const CONFIG: EngineeringClientConfig = { BOROUGH_SIM_API_URL: "https://api.example.com", AGENT_ID_TOKEN: PROD_TOKEN, AGENT_REFRESH_TOKEN: "r", AGENT_CLIENT_ID: "c", AGENT_REGION: "us-east-1" };
const BOTH: EngineeringClientConfig = {
  ...CONFIG,
  AGENT_OTHER_API_URL: "https://api.test.example.com",
  AGENT_OTHER_ID_TOKEN: TEST_TOKEN,
  AGENT_OTHER_REFRESH_TOKEN: "r2",
  AGENT_OTHER_CLIENT_ID: "c2",
};

const json = (body: unknown, status = 200) => new Response(body === null ? null : JSON.stringify(body), { status });

let fetchMock: ReturnType<typeof vi.fn>;
const client = (config: EngineeringClientConfig = CONFIG) => new BoroughSimEngineeringClient(config, { fetch: fetchMock as unknown as typeof fetch, now: () => NOW });
const sent = () => fetchMock.mock.calls as [string, RequestInit][];
const calls = () => sent().map(([url, init]) => `${init.method} ${url}`);
const bodyOf = (index: number) => JSON.parse(String(sent()[index][1].body)) as unknown;
const authOf = (index: number) => (sent()[index][1].headers as Record<string, string>).Authorization;

const FLAG = {
  flag_key: "NEAREST_OPERATOR_DISPATCH",
  description: "Nearest idle operator",
  treatments: ["C", "T1"],
  default_treatment: "C",
  overrides: [{ entity_type: "OPERATOR", entity_id: "op-1", treatment: "T1" }],
  allocations: [],
  version: 4,
  created_at: "2026-11-01T00:00:00.000Z",
  updated_at: "2026-11-02T00:00:00.000Z",
  updated_by: "admin",
};
const T1 = [{ treatment: "T1", percent: 100 }];

beforeEach(() => {
  fetchMock = vi.fn(async () => json({ ok: true }));
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("BoroughSimEngineeringClient", () => {
  it("runs a query in its own environment with the agent's token, reporting the budget left", async () => {
    fetchMock.mockResolvedValueOnce(json({ rows: [{ n: "1" }] }));
    expect(await client(BOTH).runQuery("SELECT 1")).toEqual({ status: 200, body: { rows: [{ n: "1" }], queries_remaining: ENGINEERING_QUERY_LIMIT_MAX - 1 } });
    expect(calls()).toEqual(["POST https://api.example.com/admin/warehouse/query"]);
    expect(bodyOf(0)).toEqual({ sql: "SELECT 1" });
    expect(authOf(0)).toBe(`Bearer ${PROD_TOKEN}`);
  });

  it("holds a run to the budget it sets, sending nothing past it", async () => {
    const c = client({ ...CONFIG, ENGINEERING_QUERY_LIMIT: 1 });
    expect((await c.runQuery("SELECT 1")).body).toMatchObject({ queries_remaining: 0 });
    expect((await c.runQuery("SELECT 2")).status).toBe(429);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("reads a flag in either environment with that environment's sign-in, passing failures through", async () => {
    fetchMock.mockResolvedValueOnce(json(FLAG)).mockResolvedValueOnce(json(null, 404));
    expect(await client(BOTH).getFlag("PROD", "NEAREST_OPERATOR_DISPATCH")).toEqual({ status: 200, body: FLAG });
    expect(await client(BOTH).getFlag("TEST", "A B")).toEqual({ status: 404, body: null });
    expect(calls()).toEqual(["GET https://api.example.com/feature-flags/NEAREST_OPERATOR_DISPATCH", "GET https://api.test.example.com/feature-flags/A%20B"]);
    expect(authOf(1)).toBe(`Bearer ${TEST_TOKEN}`);
  });

  it("treats the primary sign-in as Test when AGENT_ENV says so, and the other as Prod", async () => {
    await client({ ...BOTH, AGENT_ENV: "TEST" }).getFlag("TEST", "X");
    await client({ ...BOTH, AGENT_ENV: "TEST" }).getFlag("PROD", "X");
    expect(calls()).toEqual(["GET https://api.example.com/feature-flags/X", "GET https://api.test.example.com/feature-flags/X"]);
  });

  it("answers 503, sending nothing, for an environment the run has no sign-in to", async () => {
    expect(await client().getFlag("TEST", "X")).toEqual({ status: 503, body: { message: "This run has no TEST sign-in" } });
    expect((await client({ ...BOTH, AGENT_OTHER_CLIENT_ID: undefined }).createFlag("TEST", { flag_key: "X", description: "", treatments: ["C"], default_treatment: "C", overrides: [], allocations: [] })).status).toBe(503);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("creates a flag, refusing an invalid one before sending", async () => {
    const flag = { flag_key: "NEAREST_OPERATOR_DISPATCH", description: "d", treatments: ["C", "T1"], default_treatment: "T1", overrides: [], allocations: [] };
    fetchMock.mockResolvedValueOnce(json({ ...flag, version: 1 }, 201));
    expect((await client(BOTH).createFlag("TEST", flag)).status).toBe(201);
    expect(calls()).toEqual(["POST https://api.test.example.com/admin/feature-flags"]);
    expect(bodyOf(0)).toEqual(flag);
    expect((await client(BOTH).createFlag("TEST", { ...flag, default_treatment: "T2" })).status).toBe(400);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("changes only the fields given, at the version it read", async () => {
    fetchMock.mockResolvedValueOnce(json(FLAG)).mockResolvedValueOnce(json({ ...FLAG, allocations: T1, version: 5 }));
    expect(await client().updateFlag("PROD", "NEAREST_OPERATOR_DISPATCH", { allocations: T1 })).toEqual({ status: 200, body: { ...FLAG, allocations: T1, version: 5 } });
    expect(calls()).toEqual(["GET https://api.example.com/feature-flags/NEAREST_OPERATOR_DISPATCH", "PUT https://api.example.com/admin/feature-flags/NEAREST_OPERATOR_DISPATCH"]);
    expect(bodyOf(1)).toEqual({
      expected_version: 4,
      description: FLAG.description,
      treatments: FLAG.treatments,
      default_treatment: "C",
      overrides: FLAG.overrides,
      allocations: T1,
    });
  });

  it("passes a failed read through and refuses an unreadable flag or an invalid change", async () => {
    fetchMock.mockResolvedValueOnce(json({ message: "not found" }, 404));
    expect(await client().updateFlag("PROD", "NEAREST_OPERATOR_DISPATCH", { allocations: T1 })).toEqual({ status: 404, body: { message: "not found" } });
    fetchMock.mockResolvedValueOnce(json({ flag_key: "NEAREST_OPERATOR_DISPATCH" }));
    expect((await client().updateFlag("PROD", "NEAREST_OPERATOR_DISPATCH", { allocations: T1 })).status).toBe(502);
    fetchMock.mockResolvedValueOnce(json(FLAG));
    expect((await client().updateFlag("PROD", "NEAREST_OPERATOR_DISPATCH", { default_treatment: "T2" })).status).toBe(400);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("reads its config from the environment: query budget capped, Prod by default", () => {
    const env = { BOROUGH_SIM_API_URL: "https://api.example.com", AGENT_ID_TOKEN: "a", AGENT_REFRESH_TOKEN: "b", AGENT_CLIENT_ID: "c", AGENT_REGION: "us-east-1" };
    expect(EngineeringClientConfigSchema.parse(env)).toMatchObject({ AGENT_ENV: "PROD" });
    expect(EngineeringClientConfigSchema.parse(env).ENGINEERING_QUERY_LIMIT).toBeUndefined();
    expect(EngineeringClientConfigSchema.parse({ ...env, ENGINEERING_QUERY_LIMIT: "3" }).ENGINEERING_QUERY_LIMIT).toBe(3);
    expect(() => EngineeringClientConfigSchema.parse({ ...env, ENGINEERING_QUERY_LIMIT: "11" })).toThrow();
    expect(() => EngineeringClientConfigSchema.parse({ ...env, AGENT_ENV: "DEV" })).toThrow();
  });

  it("uses the real fetch by default", () => {
    expect(new BoroughSimEngineeringClient(CONFIG)).toBeInstanceOf(BoroughSimEngineeringClient);
  });
});
