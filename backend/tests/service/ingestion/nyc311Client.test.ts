import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchNyc311Page, toSoqlTimestamp } from "../../../service/ingestion/nyc311Client";
import { ValidationError } from "../../../models/errors";
import normalWithBbl from "./nyc311-normal-with-bbl.json";

let fetchMock: ReturnType<typeof vi.fn>;
let originalAppToken: string | undefined;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  originalAppToken = process.env.SOCRATA_APP_TOKEN;
  delete process.env.SOCRATA_APP_TOKEN;
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  if (originalAppToken === undefined) {
    delete process.env.SOCRATA_APP_TOKEN;
  } else {
    process.env.SOCRATA_APP_TOKEN = originalAppToken;
  }
});

describe("toSoqlTimestamp", () => {
  it("strips the milliseconds/timezone suffix SoQL's floating_timestamp rejects", () => {
    expect(toSoqlTimestamp(new Date("2026-08-10T12:34:56.789Z"))).toBe("2026-08-10T12:34:56");
  });
});

describe("fetchNyc311Page", () => {
  it("builds the SoQL query with $where/$order/$limit/$offset", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => [normalWithBbl] });
    await fetchNyc311Page({ sinceExclusive: "2026-08-10T00:00:00", offset: 40, limit: 1000 });

    const calledUrl = new URL(fetchMock.mock.calls[0][0] as string);
    expect(calledUrl.origin + calledUrl.pathname).toBe(
      "https://data.cityofnewyork.us/resource/erm2-nwe9.json"
    );
    expect(calledUrl.searchParams.get("$where")).toBe("created_date > '2026-08-10T00:00:00'");
    expect(calledUrl.searchParams.get("$order")).toBe("created_date ASC, unique_key ASC");
    expect(calledUrl.searchParams.get("$limit")).toBe("1000");
    expect(calledUrl.searchParams.get("$offset")).toBe("40");
  });

  it("omits the X-App-Token header when SOCRATA_APP_TOKEN is unset", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => [] });
    await fetchNyc311Page({ sinceExclusive: "2026-08-10T00:00:00", offset: 0, limit: 10 });
    const headers = fetchMock.mock.calls[0][1].headers as Record<string, string>;
    expect(headers["X-App-Token"]).toBeUndefined();
  });

  it("includes the X-App-Token header when SOCRATA_APP_TOKEN is set", async () => {
    process.env.SOCRATA_APP_TOKEN = "test-token";
    fetchMock.mockResolvedValue({ ok: true, json: async () => [] });
    await fetchNyc311Page({ sinceExclusive: "2026-08-10T00:00:00", offset: 0, limit: 10 });
    const headers = fetchMock.mock.calls[0][1].headers as Record<string, string>;
    expect(headers["X-App-Token"]).toBe("test-token");
  });

  it("returns the parsed JSON array on success", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => [normalWithBbl] });
    await expect(
      fetchNyc311Page({ sinceExclusive: "2026-08-10T00:00:00", offset: 0, limit: 10 })
    ).resolves.toEqual([normalWithBbl]);
  });

  it("throws when the response is not ok", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 503, statusText: "Service Unavailable" });
    await expect(
      fetchNyc311Page({ sinceExclusive: "2026-08-10T00:00:00", offset: 0, limit: 10 })
    ).rejects.toThrow("NYC 311 SODA API request failed: 503 Service Unavailable");
  });

  it("throws ValidationError when the response body is not an array", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ error: "not an array" }) });
    await expect(
      fetchNyc311Page({ sinceExclusive: "2026-08-10T00:00:00", offset: 0, limit: 10 })
    ).rejects.toBeInstanceOf(ValidationError);
  });
});
