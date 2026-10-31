import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getOpenApiSpec } from "../../../service/publicApi/publicApiService";

beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("getOpenApiSpec", () => {
  it("reads the spec as text", async () => {
    const spec = await getOpenApiSpec({ specPath: join(__dirname, "../../../controller/web-api/publicV1/openapi.yaml") });
    expect(spec.startsWith("openapi: 3.1.0")).toBe(true);
  });

  it("reads the copy beside the handler by default, as the Lambda bundle has", async () => {
    await expect(getOpenApiSpec()).rejects.toThrow(/openapi\.yaml/);
  });
});
