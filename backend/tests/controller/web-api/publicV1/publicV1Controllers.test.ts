import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NotFoundError, ValidationError } from "../../../../models/errors";
import type { FeatureRequest } from "../../../../models/publicApi/featureRequest";

/*
 * Every test that mocks publicApiService lives here: the suite runs with
 * isolate: false, so one complete mock of the service, declared once, is
 * what every controller sees.
 */
vi.mock("../../../../service/publicApi/publicApiService", () => ({
  getOpenApiSpec: vi.fn(),
  searchRequests: vi.fn(),
  createFeatureRequest: vi.fn(),
  getFeatureRequest: vi.fn(),
}));

import { createFeatureRequestController } from "../../../../controller/web-api/publicV1/createFeatureRequestController";
import { getFeatureRequestController } from "../../../../controller/web-api/publicV1/getFeatureRequestController";
import { getOpenApiSpecController } from "../../../../controller/web-api/publicV1/getOpenApiSpecController";
import { publicV1ApiRouter } from "../../../../controller/web-api/publicV1/publicV1ApiRouter";
import { searchRequestsController } from "../../../../controller/web-api/publicV1/searchRequestsController";
import { createFeatureRequest, getFeatureRequest, getOpenApiSpec, searchRequests } from "../../../../service/publicApi/publicApiService";

beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  for (const mock of [getOpenApiSpec, searchRequests, createFeatureRequest, getFeatureRequest]) vi.mocked(mock).mockReset();
  vi.mocked(getOpenApiSpec).mockResolvedValue("openapi: 3.1.0\n");
});

afterEach(() => {
  vi.restoreAllMocks();
});

const ORDER_ID = "01K7XWQ2B9N4M8F3T6RZ0Y5DKA";
const context = { call_id: "C", requester: "resident:hawthorn" };

function event(body: string | null): unknown {
  return { rawPath: "/v1/requests/search", requestContext: { http: { method: "POST" } }, headers: {}, body };
}

const ID = "01K8C4T1W7H3P9N2M6QZ8V0RJD";
const featureRequest: FeatureRequest = {
  feature_request_id: ID,
  status: "RECEIVED",
  status_reason_description: null,
  title: "Text me when a repair near me is scheduled",
  description: "Let me subscribe to a street.",
  submitted_by: { name: "Hawthorn" },
  created_at: "2026-11-02T22:14:02.000Z",
  updated_at: "2026-11-02T22:14:02.000Z",
};
const body = { title: featureRequest.title, description: featureRequest.description, submitted_by: { name: "Hawthorn", email: null } };

function postEvent(rawBody: string, headers: Record<string, string> = {}): unknown {
  return { rawPath: "/v1/feature-requests", requestContext: { http: { method: "POST" } }, headers, body: rawBody };
}

function getEvent(pathParameters: Record<string, string> | null): unknown {
  return { rawPath: `/v1/feature-requests/${ID}`, requestContext: { http: { method: "GET" } }, headers: {}, pathParameters };
}


describe("getOpenApiSpecController", () => {
  it("returns the spec as YAML", async () => {
    const result = await getOpenApiSpecController({}, { call_id: "C", requester: "integration-test" });
    expect(result).toEqual({
      status_code: 200,
      body: "openapi: 3.1.0\n",
      content_type: "application/yaml",
      usage: { request_params: null, result_count: null, resource_id: null },
    });
  });
});

describe("publicV1ApiRouter", () => {
  it("serves the spec", async () => {
    const response = await publicV1ApiRouter({
      routeKey: "GET /v1/openapi.yaml",
      rawPath: "/v1/openapi.yaml",
      requestContext: { http: { method: "GET" } },
      headers: { "x-requester": "integration-test" },
    });
    expect(response.statusCode).toBe(200);
    expect(response.body).toBe("openapi: 3.1.0\n");
    expect(response.headers?.["X-Call-Id"]).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
  });
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

describe("createFeatureRequestController", () => {
  it("files the request with its Idempotency-Key and records only the id", async () => {
    vi.mocked(createFeatureRequest).mockResolvedValue(featureRequest);
    const result = await createFeatureRequestController(
      postEvent(JSON.stringify(body), { "idempotency-key": "b6f0c1e2-7a4d-4c1e-9d55-2f0e8c3a9b11" }),
      context
    );
    expect(createFeatureRequest).toHaveBeenCalledWith(body, "b6f0c1e2-7a4d-4c1e-9d55-2f0e8c3a9b11");
    expect(result).toEqual({
      status_code: 201,
      body: featureRequest,
      usage: { request_params: null, result_count: null, resource_id: ID },
    });
  });

  it("files without a key when none is sent", async () => {
    vi.mocked(createFeatureRequest).mockResolvedValue(featureRequest);
    await createFeatureRequestController(postEvent(JSON.stringify(body)), context);
    expect(createFeatureRequest).toHaveBeenCalledWith(body, null);
  });

  it("rejects a body over 8 KB", async () => {
    const result = await createFeatureRequestController(postEvent("x".repeat(8 * 1024 + 1)), context);
    expect(result.body).toMatchObject({ error: { code: "VALIDATION_ERROR", details: [{ field: "body", issue: "must be at most 8 KB" }] } });
  });

  it("rejects a malformed Idempotency-Key", async () => {
    const result = await createFeatureRequestController(postEvent(JSON.stringify(body), { "idempotency-key": "no" }), context);
    expect(result.body).toMatchObject({ error: { details: [{ field: "Idempotency-Key" }] } });
    expect(createFeatureRequest).not.toHaveBeenCalled();
  });

  it("rejects a body that isn't JSON, or has a missing body", async () => {
    expect((await createFeatureRequestController(postEvent("{"), context)).status_code).toBe(400);
    const noBody = await createFeatureRequestController(
      { rawPath: "/v1/feature-requests", requestContext: { http: { method: "POST" } } },
      context
    );
    expect(noBody.body).toMatchObject({ error: { details: [{ field: "body", issue: "is not valid JSON" }] } });
  });

  it("names each failing field", async () => {
    const result = await createFeatureRequestController(postEvent(JSON.stringify({ ...body, title: "Hi" })), context);
    expect(result.body).toMatchObject({ error: { code: "VALIDATION_ERROR", details: [{ field: "title" }] } });
  });
});

describe("getFeatureRequestController", () => {
  it("returns the feature request", async () => {
    vi.mocked(getFeatureRequest).mockResolvedValue(featureRequest);
    expect(await getFeatureRequestController(getEvent({ feature_request_id: ID }), context)).toEqual({
      status_code: 200,
      body: featureRequest,
      usage: { request_params: null, result_count: null, resource_id: ID },
    });
  });

  it.each([{ feature_request_id: "nope" }, null])("rejects a malformed or missing id (%j)", async (params) => {
    const result = await getFeatureRequestController(getEvent(params), context);
    expect(result.body).toMatchObject({ error: { code: "VALIDATION_ERROR", details: [{ field: "path.feature_request_id" }] } });
  });

  it("answers an unknown id with NOT_FOUND", async () => {
    vi.mocked(getFeatureRequest).mockRejectedValue(new NotFoundError("gone"));
    const result = await getFeatureRequestController(getEvent({ feature_request_id: ID }), context);
    expect(result).toMatchObject({ status_code: 404, body: { error: { code: "NOT_FOUND" } } });
  });

  it("lets any other failure reach the router", async () => {
    vi.mocked(getFeatureRequest).mockRejectedValue(new Error("ddb"));
    await expect(getFeatureRequestController(getEvent({ feature_request_id: ID }), context)).rejects.toThrow("ddb");
  });
});
