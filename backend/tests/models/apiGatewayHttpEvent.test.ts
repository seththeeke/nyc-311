import { describe, expect, it } from "vitest";
import { ApiGatewayHttpEventSchema } from "../../models/apiGatewayHttpEvent";

const validEvent = {
  rawPath: "/ingestion/metrics",
  requestContext: { http: { method: "GET" } },
  queryStringParameters: null,
  headers: { origin: "http://localhost:5173" },
  body: null,
};

describe("ApiGatewayHttpEventSchema", () => {
  it("accepts a well-formed HTTP API v2 proxy event", () => {
    expect(ApiGatewayHttpEventSchema.parse(validEvent)).toEqual(validEvent);
  });

  it("accepts the minimal required shape, with optional fields omitted", () => {
    const minimal = { rawPath: "/ingestion/metrics", requestContext: { http: { method: "GET" } } };
    expect(ApiGatewayHttpEventSchema.parse(minimal)).toEqual(minimal);
  });

  it("rejects a payload missing rawPath", () => {
    const withoutRawPath: Record<string, unknown> = { ...validEvent };
    delete withoutRawPath.rawPath;
    expect(ApiGatewayHttpEventSchema.safeParse(withoutRawPath).success).toBe(false);
  });

  it("rejects a payload missing requestContext.http.method", () => {
    expect(
      ApiGatewayHttpEventSchema.safeParse({ rawPath: "/ingestion/metrics", requestContext: { http: {} } })
        .success
    ).toBe(false);
  });

  it("rejects a non-object payload", () => {
    expect(ApiGatewayHttpEventSchema.safeParse("not-an-object").success).toBe(false);
    expect(ApiGatewayHttpEventSchema.safeParse(null).success).toBe(false);
  });
});
