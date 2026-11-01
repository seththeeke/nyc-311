import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createPublicV1Router } from "../../../../controller/web-api/publicV1/createPublicV1Router";
import type { PublicApiCall } from "../../../../models/publicApi/publicApiCall";

const CALL_ID = "01K8D2ZZZZZZZZZZZZZZZZZZZZ";

function event(routeKey: string, headers: Record<string, string> = { "x-requester": "resident:hawthorn" }): unknown {
  return { routeKey, rawPath: "/v1/x", requestContext: { http: { method: "GET" } }, headers };
}

let calls: PublicApiCall[];
let clock: number;

function router(controllers: Parameters<typeof createPublicV1Router>[0]) {
  return createPublicV1Router(controllers, {
    newCallId: () => CALL_ID,
    now: () => (clock += 25),
    recordCall: async (call) => {
      calls.push(call);
    },
  });
}

beforeEach(() => {
  calls = [];
  clock = Date.parse("2026-11-02T22:14:00.000Z");
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("createPublicV1Router", () => {
  it("dispatches with the call context and records the call", async () => {
    const controller = vi.fn().mockResolvedValue({
      status_code: 200,
      body: { items: [], next_cursor: null },
      usage: { request_params: "order_id=X", result_count: 0, resource_id: null },
    });
    const response = await router({ "POST /v1/requests/search": controller })(event("POST /v1/requests/search"));

    expect(controller).toHaveBeenCalledWith(expect.anything(), { call_id: CALL_ID, requester: "resident:hawthorn" });
    expect(response).toEqual({
      statusCode: 200,
      headers: { "Content-Type": "application/json", "X-Call-Id": CALL_ID },
      body: JSON.stringify({ items: [], next_cursor: null }),
    });
    expect(calls).toEqual([
      {
        call_id: CALL_ID,
        requester: "resident:hawthorn",
        operation: "SEARCH_REQUESTS",
        route_key: "POST /v1/requests/search",
        status_code: 200,
        outcome: "SUCCESS",
        latency_ms: 25,
        request_params: "order_id=X",
        result_count: 0,
        resource_id: null,
        occurred_at: "2026-11-02T22:14:00.025Z",
      },
    ]);
  });

  it("sends a string body as-is with its content type", async () => {
    const controller = vi.fn().mockResolvedValue({
      status_code: 200,
      body: "openapi: 3.1.0",
      content_type: "application/yaml",
      usage: { request_params: null, result_count: null, resource_id: null },
    });
    const response = await router({ "GET /v1/openapi.yaml": controller })(event("GET /v1/openapi.yaml"));
    expect(response.body).toBe("openapi: 3.1.0");
    expect(response.headers).toEqual({ "Content-Type": "application/yaml", "X-Call-Id": CALL_ID });
  });

  it.each([[{}], [{ "x-requester": "Not Valid" }]])("rejects a missing or malformed X-Requester (%j) without dispatching", async (headers) => {
    const controller = vi.fn();
    const response = await router({ "GET /v1/openapi.yaml": controller })(event("GET /v1/openapi.yaml", headers));
    expect(controller).not.toHaveBeenCalled();
    expect(response.statusCode).toBe(400);
    expect(JSON.parse(String(response.body))).toEqual({
      error: { code: "INVALID_REQUESTER", message: "The X-Requester header is missing or malformed." },
    });
    expect(calls[0]).toMatchObject({ requester: "UNKNOWN", outcome: "CLIENT_ERROR", operation: "GET_OPENAPI_SPEC" });
  });

  it("answers a malformed event with VALIDATION_ERROR", async () => {
    const response = await router({})({ routeKey: "GET /v1/openapi.yaml" });
    expect(response.statusCode).toBe(400);
    expect(JSON.parse(String(response.body)).error.code).toBe("VALIDATION_ERROR");
  });

  it("answers a route with no controller, or an unknown route, with NOT_FOUND", async () => {
    const r = router({});
    expect((await r(event("GET /v1/openapi.yaml"))).statusCode).toBe(404);
    const unknown = await r(event("GET /v1/nope"));
    expect(unknown.statusCode).toBe(404);
    expect(calls[1]).toMatchObject({ operation: "UNKNOWN", route_key: "GET /v1/nope" });
  });

  it("records UNKNOWN as the route key when the event has none", async () => {
    await router({})({ headers: {} });
    expect(calls[0]).toMatchObject({ route_key: "UNKNOWN", operation: "UNKNOWN" });
  });

  it("turns a thrown controller error into INTERNAL_ERROR with no internal detail", async () => {
    const response = await router({ "GET /v1/openapi.yaml": vi.fn().mockRejectedValue(new Error("secret table name")) })(
      event("GET /v1/openapi.yaml")
    );
    expect(response.statusCode).toBe(500);
    expect(response.body).not.toContain("secret");
    expect(JSON.parse(String(response.body)).error.code).toBe("INTERNAL_ERROR");
    expect(calls[0].outcome).toBe("SERVER_ERROR");
  });

  it("logs a non-Error rejection too", async () => {
    const response = await router({ "GET /v1/openapi.yaml": vi.fn().mockRejectedValue("boom") })(event("GET /v1/openapi.yaml"));
    expect(response.statusCode).toBe(500);
  });

  it("still answers when recording the call fails", async () => {
    const r = createPublicV1Router(
      { "GET /v1/openapi.yaml": vi.fn().mockResolvedValue({ status_code: 200, body: "x", usage: { request_params: null, result_count: null, resource_id: null } }) },
      { recordCall: vi.fn().mockRejectedValue(new Error("sns down")) }
    );
    expect((await r(event("GET /v1/openapi.yaml"))).statusCode).toBe(200);
    const r2 = createPublicV1Router({}, { recordCall: vi.fn().mockRejectedValue("down") });
    expect((await r2(event("GET /v1/openapi.yaml"))).statusCode).toBe(404);
  });

  it("records through the usage service by default, and still answers when that fails", async () => {
    const log = vi.spyOn(console, "log");
    const previous = process.env.PUBLIC_API_CALLS_TOPIC_ARN;
    delete process.env.PUBLIC_API_CALLS_TOPIC_ARN;
    try {
      const response = await createPublicV1Router({})(event("GET /v1/openapi.yaml"));
      expect(response.statusCode).toBe(404);
      expect(log.mock.calls.some(([line]) => String(line).includes('"message":"PublicApiCall"'))).toBe(true);
    } finally {
      if (previous !== undefined) process.env.PUBLIC_API_CALLS_TOPIC_ARN = previous;
    }
  });
});
