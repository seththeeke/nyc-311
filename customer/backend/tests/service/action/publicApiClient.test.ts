import { afterEach, describe, expect, it, vi } from "vitest";
import { callPublicApi } from "../../../service/action/publicApiClient";

function reply(status: number, body: string, callId: string | null = "01CALL") {
  return { status, text: async () => body, headers: { get: (name: string) => (name === "x-call-id" ? callId : null) } } as unknown as Response;
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("callPublicApi", () => {
  it("calls the public URL with the recipe's headers and JSON body, and returns status, call id and parsed body", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    const fetchFn = vi.fn().mockResolvedValue(reply(200, '{"items":[]}'));
    const result = await callPublicApi(
      { method: "POST", path: "/v1/requests/search", body: { a: 1 }, headers: { "X-Requester": "resident:hawthorn" } },
      { fetchFn, baseUrl: "https://public-api.example.com" }
    );
    expect(result).toEqual({ status_code: 200, call_id: "01CALL", body: { items: [] } });
    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toBe("https://public-api.example.com/v1/requests/search");
    expect(init).toMatchObject({ method: "POST", body: '{"a":1}', headers: { "Content-Type": "application/json", "X-Requester": "resident:hawthorn" } });
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it("keeps a non-JSON body as text, sends no body on a GET, and reads the base URL from the environment", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.stubEnv("PUBLIC_API_BASE_URL", "https://public-api.boroughsim.com");
    const fetchFn = vi.fn().mockResolvedValue(reply(429, "Too Many Requests", null));
    const result = await callPublicApi({ method: "GET", path: "/v1/feature-requests/X", headers: {} }, { fetchFn });
    expect(result).toEqual({ status_code: 429, call_id: null, body: "Too Many Requests" });
    expect(fetchFn.mock.calls[0][0]).toBe("https://public-api.boroughsim.com/v1/feature-requests/X");
    expect(fetchFn.mock.calls[0][1]).not.toHaveProperty("body");
  });

  it("uses the global fetch by default", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    const fetchFn = vi.fn().mockResolvedValue(reply(200, "{}"));
    vi.stubGlobal("fetch", fetchFn);
    try {
      await callPublicApi({ method: "GET", path: "/v1/openapi.yaml", headers: {} }, { baseUrl: "https://p" });
    } finally {
      vi.unstubAllGlobals();
    }
    expect(fetchFn).toHaveBeenCalledOnce();
  });
});
