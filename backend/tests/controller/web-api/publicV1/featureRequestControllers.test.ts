import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NotFoundError } from "../../../../models/errors";
import type { FeatureRequest } from "../../../../models/publicApi/featureRequest";

vi.mock("../../../../service/publicApi/publicApiService", () => ({
  createFeatureRequest: vi.fn(),
  getFeatureRequest: vi.fn(),
}));

import { createFeatureRequestController } from "../../../../controller/web-api/publicV1/createFeatureRequestController";
import { getFeatureRequestController } from "../../../../controller/web-api/publicV1/getFeatureRequestController";
import { createFeatureRequest, getFeatureRequest } from "../../../../service/publicApi/publicApiService";

const ID = "01K8C4T1W7H3P9N2M6QZ8V0RJD";
const context = { call_id: "C", requester: "resident:hawthorn" };
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

beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.mocked(createFeatureRequest).mockReset();
  vi.mocked(getFeatureRequest).mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
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
