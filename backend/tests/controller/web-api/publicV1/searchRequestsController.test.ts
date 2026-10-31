import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ValidationError } from "../../../../models/errors";

vi.mock("../../../../service/publicApi/publicApiService", () => ({
  searchRequests: vi.fn(),
}));

import { searchRequestsController } from "../../../../controller/web-api/publicV1/searchRequestsController";
import { searchRequests } from "../../../../service/publicApi/publicApiService";

const ORDER_ID = "01K7XWQ2B9N4M8F3T6RZ0Y5DKA";
const context = { call_id: "C", requester: "resident:hawthorn" };

function event(body: string | null): unknown {
  return { rawPath: "/v1/requests/search", requestContext: { http: { method: "POST" } }, headers: {}, body };
}

beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.mocked(searchRequests).mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("searchRequestsController", () => {
  it("searches and reports the filters and result count", async () => {
    vi.mocked(searchRequests).mockResolvedValue({ items: [], next_cursor: null });
    const result = await searchRequestsController(event(JSON.stringify({ search_params: { order_id: ORDER_ID } })), context);
    expect(searchRequests).toHaveBeenCalledWith({ search_params: { order_id: ORDER_ID }, limit: 20 });
    expect(result).toEqual({
      status_code: 200,
      body: { items: [], next_cursor: null },
      usage: { request_params: `order_id=${ORDER_ID}`, result_count: 0, resource_id: null },
    });
  });

  it.each([null, "not json"])("rejects a body that isn't JSON (%s)", async (body) => {
    const result = await searchRequestsController(event(body), context);
    expect(result.status_code).toBe(400);
    expect(result.body).toMatchObject({ error: { code: "VALIDATION_ERROR", details: [{ field: "body", issue: "is not valid JSON" }] } });
  });

  it("names each failing field", async () => {
    const result = await searchRequestsController(event(JSON.stringify({ search_params: { order_id: "nope" } })), context);
    expect(result.status_code).toBe(400);
    expect(result.body).toMatchObject({ error: { code: "VALIDATION_ERROR", details: [{ field: "search_params.order_id", issue: "must be a ULID" }] } });
    expect(searchRequests).not.toHaveBeenCalled();
  });

  it("turns the service's ValidationError into a 400 with its details", async () => {
    vi.mocked(searchRequests).mockRejectedValue(new ValidationError("bad cursor", [{ field: "cursor", issue: "does not belong to this search" }]));
    const result = await searchRequestsController(event(JSON.stringify({ search_params: { order_id: ORDER_ID }, cursor: "x" })), context);
    expect(result).toMatchObject({
      status_code: 400,
      body: { error: { code: "VALIDATION_ERROR", details: [{ field: "cursor", issue: "does not belong to this search" }] } },
      usage: { request_params: `order_id=${ORDER_ID}` },
    });
  });

  it("drops details it can't show", async () => {
    vi.mocked(searchRequests).mockRejectedValue(new ValidationError("bad", "internal detail"));
    const result = await searchRequestsController(event(JSON.stringify({ search_params: { order_id: ORDER_ID } })), context);
    expect(result.body).toEqual({ error: { code: "VALIDATION_ERROR", message: "bad" } });
  });

  it("lets any other failure reach the router", async () => {
    vi.mocked(searchRequests).mockRejectedValue(new Error("ddb down"));
    await expect(searchRequestsController(event(JSON.stringify({ search_params: { order_id: ORDER_ID } })), context)).rejects.toThrow("ddb down");
  });
});
