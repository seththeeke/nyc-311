import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../../service/publicApi/publicApiService", () => ({
  getOpenApiSpec: vi.fn().mockResolvedValue("openapi: 3.1.0\n"),
}));

import { publicV1ApiRouter } from "../../../../controller/web-api/publicV1/publicV1ApiRouter";

beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
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
