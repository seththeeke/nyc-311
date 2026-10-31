import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../../service/publicApi/publicApiService", () => ({
  getOpenApiSpec: vi.fn().mockResolvedValue("openapi: 3.1.0\n"),
}));

import { getOpenApiSpecController } from "../../../../controller/web-api/publicV1/getOpenApiSpecController";

beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

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
