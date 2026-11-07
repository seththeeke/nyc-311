import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BoroughSimProductClient, MAX_QUERIES_PER_RUN } from "../../../service/productClient/boroughSimProductClient";

const NOW = new Date("2026-11-05T10:00:00.000Z");
const FRESH = `h.${Buffer.from(JSON.stringify({ exp: NOW.getTime() / 1000 + 3600 })).toString("base64url")}.s`;
const CONFIG = { BOROUGH_SIM_API_URL: "https://api.example.com", AGENT_ID_TOKEN: FRESH, AGENT_REFRESH_TOKEN: "r", AGENT_CLIENT_ID: "c", AGENT_REGION: "us-east-1" };

const json = (body: unknown, status = 200) => new Response(body === null ? null : JSON.stringify(body), { status });

let fetchMock: ReturnType<typeof vi.fn>;
const client = () => new BoroughSimProductClient(CONFIG, { fetch: fetchMock as unknown as typeof fetch, now: () => NOW });
const calls = () => (fetchMock.mock.calls as [string, RequestInit][]).map(([url, init]) => `${init.method} ${url}`);

beforeEach(() => {
  fetchMock = vi.fn(async () => json({ ok: true }));
  vi.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("BoroughSimProductClient", () => {
  it("lists feature requests with the given filters and updates a contact by PATCH", async () => {
    await client().listContacts({ status: "RECEIVED", limit: 50, cursor: undefined });
    fetchMock.mockResolvedValueOnce(json(null, 204));
    expect(await client().updateContact({ contact_id: "C 1", status: "IN_PROGRESS", ticket_number: 170, status_reason_description: "Ticket #170." })).toEqual({ status: 204, body: null });
    expect(calls()).toEqual(["GET https://api.example.com/contacts?type=FEATURE_REQUEST&status=RECEIVED&limit=50", "PATCH https://api.example.com/admin/contacts/C%201"]);
    const patch = (fetchMock.mock.calls as [string, RequestInit][])[1][1];
    expect(JSON.parse(String(patch.body))).toEqual({ status: "IN_PROGRESS", ticket_number: 170, status_reason_description: "Ticket #170." });
    expect((patch.headers as Record<string, string>).Authorization).toBe(`Bearer ${FRESH}`);
  });

  it("reads the newest successful wbr runs and their results", async () => {
    const runs = [
      { job_run_id: "R1", job_name: "wbr", status: "SUCCEEDED", started_at: "2026-10-27T06:00:00Z" },
      { job_run_id: "R2", job_name: "wbr", status: "SUCCEEDED", started_at: "2026-11-03T06:00:00Z" },
      { job_run_id: "R3", job_name: "wbr", status: "FAILED", started_at: "2026-11-04T06:00:00Z" },
      { job_run_id: "R4", job_name: "other", status: "SUCCEEDED", started_at: "2026-11-04T06:00:00Z" },
    ];
    fetchMock.mockResolvedValueOnce(json({ jobRuns: runs })).mockResolvedValueOnce(json({ results: [{ job_run_id: "R2" }] }));
    const wbr = await client().getWbr(1);
    expect(wbr).toEqual({ status: 200, body: { runs: [runs[1]], results: [{ job_run_id: "R2" }] } });
    expect(calls()).toEqual(["GET https://api.example.com/admin/warehouse/job-runs", "POST https://api.example.com/admin/warehouse/job-runs/results"]);
    expect(JSON.parse(String((fetchMock.mock.calls as [string, RequestInit][])[1][1].body))).toEqual({ job_run_ids: ["R2"] });
  });

  it("passes failures through and returns empty when there's no wbr run", async () => {
    fetchMock.mockResolvedValueOnce(json({ message: "no" }, 403));
    expect((await client().getWbr(4)).status).toBe(403);
    fetchMock.mockResolvedValueOnce(json({}));
    expect(await client().getWbr(4)).toEqual({ status: 200, body: { runs: [], results: [] } });
    fetchMock.mockResolvedValueOnce(json({ jobRuns: [{ job_run_id: "R1", job_name: "wbr", status: "SUCCEEDED", started_at: "x" }] })).mockResolvedValueOnce(json({ message: "boom" }, 500));
    expect((await client().getWbr(4)).status).toBe(500);
  });

  it("runs a query, reporting the budget left, and sends nothing past the budget", async () => {
    const c = client();
    fetchMock.mockResolvedValueOnce(json({ rows: [{ n: "1" }] }));
    expect(await c.runQuery("SELECT 1")).toEqual({ status: 200, body: { rows: [{ n: "1" }], queries_remaining: MAX_QUERIES_PER_RUN - 1 } });
    expect(calls()).toEqual(["POST https://api.example.com/admin/warehouse/query"]);
    expect(JSON.parse(String((fetchMock.mock.calls as [string, RequestInit][])[0][1].body))).toEqual({ sql: "SELECT 1" });
    fetchMock.mockResolvedValueOnce(json({ message: "bad sql" }, 400));
    expect(await c.runQuery("SELEC 1")).toEqual({ status: 400, body: { message: "bad sql", queries_remaining: MAX_QUERIES_PER_RUN - 2 } });
    fetchMock.mockResolvedValueOnce(json(null, 204));
    expect(await c.runQuery("SELECT 2")).toEqual({ status: 204, body: { result: null, queries_remaining: MAX_QUERIES_PER_RUN - 3 } });
    for (let i = 3; i < MAX_QUERIES_PER_RUN; i += 1) await c.runQuery("SELECT 3");
    expect(fetchMock).toHaveBeenCalledTimes(MAX_QUERIES_PER_RUN);
    const over = await c.runQuery("SELECT 4");
    expect(over.status).toBe(429);
    expect(over.body).toMatchObject({ queries_remaining: 0 });
    expect(fetchMock).toHaveBeenCalledTimes(MAX_QUERIES_PER_RUN);
    expect((await client().runQuery("SELECT 1")).status).toBe(200);
  });

  it("uses the real fetch by default", () => {
    expect(new BoroughSimProductClient(CONFIG)).toBeInstanceOf(BoroughSimProductClient);
  });
});
