import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BoroughSimOpsClient } from "../../../service/opsClient/boroughSimOpsClient";

const NOW = new Date("2026-11-01T10:00:00.000Z");
const FRESH = `h.${Buffer.from(JSON.stringify({ exp: NOW.getTime() / 1000 + 3600 })).toString("base64url")}.s`;
const CONFIG = { BOROUGH_SIM_API_URL: "https://api.example.com", AGENT_ID_TOKEN: FRESH, AGENT_REFRESH_TOKEN: "r", AGENT_CLIENT_ID: "c", AGENT_REGION: "us-east-1" };

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }));
  vi.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("BoroughSimOpsClient", () => {
  it("reads the snapshot, recruits and releases with the ID token and the reason", async () => {
    const client = new BoroughSimOpsClient(CONFIG, { fetch: fetchMock as unknown as typeof fetch, now: () => NOW });
    expect(await client.getCapacitySnapshot()).toEqual({ status: 200, body: { ok: true } });
    await client.recruitOperator("Truck 14", "Median 2.6 days");
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 409 }));
    expect(await client.releaseOperator("01 A", "Idle")).toEqual({ status: 409, body: null });
    const calls = fetchMock.mock.calls as [string, RequestInit][];
    expect(calls.map(([url, init]) => `${init.method} ${url}`)).toEqual(["GET https://api.example.com/capacity/snapshot", "POST https://api.example.com/capacity", "DELETE https://api.example.com/capacity/01%20A"]);
    expect((calls[1][1].headers as Record<string, string>).Authorization).toBe(`Bearer ${FRESH}`);
    expect(JSON.parse(String(calls[1][1].body))).toEqual({ name: "Truck 14", reason: "Median 2.6 days" });
    expect(JSON.parse(String(calls[2][1].body))).toEqual({ reason: "Idle" });
  });

  it("uses the real fetch by default", () => {
    expect(new BoroughSimOpsClient(CONFIG)).toBeInstanceOf(BoroughSimOpsClient);
  });
});
