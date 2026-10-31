import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";
import type { ZodType } from "zod";
import { describe, expect, it } from "vitest";
import { PUBLIC_V1_API_ROUTES } from "../../../../controller/web-api/publicV1/publicV1ApiRoutes";
import { CreateFeatureRequestBodySchema, FEATURE_REQUEST_STATUSES, FeatureRequestSchema } from "../../../../models/publicApi/featureRequest";
import { PUBLIC_API_ERROR_CODES, PublicApiErrorSchema } from "../../../../models/publicApi/publicApiError";
import { IdempotencyKeySchema, RequesterSchema, UlidSchema } from "../../../../models/publicApi/publicApiPrimitives";
import { SearchRequestsBodySchema, SearchRequestsResponseSchema } from "../../../../models/publicApi/searchRequests";
import { SERVICE_REQUEST_STATUSES } from "../../../../models/publicApi/serviceRequest";

/*
 * .claude/API.md §1: the hand-maintained spec, the route list and the zod
 * schemas must agree. These tests are the check; never weaken them to land
 * a change.
 */

type Json = Record<string, unknown>;

const spec = parse(readFileSync(join(__dirname, "../../../../controller/web-api/publicV1/openapi.yaml"), "utf8")) as Json;
const HTTP_METHODS = ["get", "put", "post", "delete", "patch", "head", "options"];

function at(node: unknown, ...keys: string[]): Json {
  let current = node;
  for (const key of keys) current = (current as Json | undefined)?.[key];
  return (current ?? {}) as Json;
}

function resolve(node: Json): Json {
  const ref = node.$ref;
  if (typeof ref !== "string") return node;
  return at(spec, ...ref.replace(/^#\//, "").split("/"));
}

/* Every operation in the spec as "METHOD /path". */
function specRouteKeys(): string[] {
  return Object.entries(at(spec, "paths")).flatMap(([path, item]) =>
    Object.keys(item as Json)
      .filter((key) => HTTP_METHODS.includes(key))
      .map((method) => `${method.toUpperCase()} ${path}`)
  );
}

/* Every named example in the spec, keyed "<route key> request" or "<route key> <status>". */
function specExamples(): Map<string, unknown[]> {
  const examples = new Map<string, unknown[]>();
  const add = (key: string, content: Json) => {
    for (const media of Object.values(content)) {
      for (const example of Object.values(at(media, "examples"))) {
        examples.set(key, [...(examples.get(key) ?? []), at(example, "value")]);
      }
    }
  };
  for (const routeKey of specRouteKeys()) {
    const [method, path] = routeKey.split(" ");
    const operation = at(spec, "paths", path, method.toLowerCase());
    add(`${routeKey} request`, at(resolve(at(operation, "requestBody")), "content"));
    for (const [status, response] of Object.entries(at(operation, "responses"))) {
      add(`${routeKey} ${status}`, at(resolve(response as Json), "content"));
    }
  }
  return examples;
}

const EXAMPLE_SCHEMAS: Record<string, ZodType> = {
  "POST /v1/requests/search request": SearchRequestsBodySchema,
  "POST /v1/requests/search 200": SearchRequestsResponseSchema,
  "POST /v1/requests/search 400": PublicApiErrorSchema,
  "POST /v1/requests/search 500": PublicApiErrorSchema,
  "POST /v1/feature-requests request": CreateFeatureRequestBodySchema,
  "POST /v1/feature-requests 201": FeatureRequestSchema,
  "POST /v1/feature-requests 400": PublicApiErrorSchema,
  "POST /v1/feature-requests 500": PublicApiErrorSchema,
  "GET /v1/feature-requests/{feature_request_id} 200": FeatureRequestSchema,
  "GET /v1/feature-requests/{feature_request_id} 400": PublicApiErrorSchema,
  "GET /v1/feature-requests/{feature_request_id} 404": PublicApiErrorSchema,
  "GET /v1/feature-requests/{feature_request_id} 500": PublicApiErrorSchema,
  "GET /v1/openapi.yaml 400": PublicApiErrorSchema,
};

describe("openapi.yaml", () => {
  it("is OpenAPI 3.1", () => {
    expect(spec.openapi).toBe("3.1.0");
  });

  it("documents exactly the routes in publicV1ApiRoutes.ts", () => {
    expect(specRouteKeys().sort()).toEqual([...PUBLIC_V1_API_ROUTES].sort());
  });

  it("has a schema check for every example, and an example for every schema check", () => {
    const examples = specExamples();
    expect([...examples.keys()].sort()).toEqual(Object.keys(EXAMPLE_SCHEMAS).sort());
  });

  it.each(Object.entries(EXAMPLE_SCHEMAS))("every %s example parses through its zod schema", (key, schema) => {
    for (const example of specExamples().get(key) ?? []) {
      const parsed = schema.safeParse(example);
      expect(parsed.success, JSON.stringify(parsed.error?.issues)).toBe(true);
    }
  });

  it("requires X-Requester on every operation", () => {
    for (const routeKey of specRouteKeys()) {
      const [method, path] = routeKey.split(" ");
      const parameters = at(spec, "paths", path, method.toLowerCase()).parameters as Json[];
      expect(parameters.map((p) => p.$ref)).toContain("#/components/parameters/XRequester");
    }
  });

  it("declares the same enums and formats as the zod schemas", () => {
    const schemas = at(spec, "components", "schemas");
    expect(at(schemas, "FeatureRequest", "properties", "status").enum).toEqual([...FEATURE_REQUEST_STATUSES]);
    expect(at(schemas, "ServiceRequest", "properties", "status").enum).toEqual([...SERVICE_REQUEST_STATUSES]);
    expect(at(schemas, "Error", "properties", "error", "properties", "code").enum).toEqual([...PUBLIC_API_ERROR_CODES]);

    const pattern = (node: Json) => new RegExp(String(node.pattern));
    const requester = pattern(at(spec, "components", "parameters", "XRequester", "schema"));
    const idempotencyKey = pattern(at(spec, "components", "parameters", "IdempotencyKey", "schema"));
    const ulid = pattern(at(schemas, "Ulid"));
    for (const value of ["resident:hawthorn", "integration-test", "Bad", "", "a".repeat(65)]) {
      expect(requester.test(value)).toBe(RequesterSchema.safeParse(value).success);
    }
    for (const value of ["b6f0c1e2-7a4d-4c1e-9d55-2f0e8c3a9b11", "short", "has space here"]) {
      expect(idempotencyKey.test(value)).toBe(IdempotencyKeySchema.safeParse(value).success);
    }
    for (const value of ["01K8C4T1W7H3P9N2M6QZ8V0RJD", "01K8C4T1W7H3P9N2M6QZ8V0RJ", "01K8C4T1W7H3P9N2M6QZ8V0RJI"]) {
      expect(ulid.test(value)).toBe(UlidSchema.safeParse(value).success);
    }
  });
});
