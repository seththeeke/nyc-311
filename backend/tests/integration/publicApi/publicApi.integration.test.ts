/**
 * Real-integration tier for the public API (16-resident-action-models.md
 * §2, .claude/API.md §5): every /v1/ route against a live deployment.
 * Creating feature requests runs in Test only, so Prod's Contacts never
 * fill with test data. Skipped locally: the public API has no SAM target.
 */

import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { FeatureRequestSchema } from "../../../models/publicApi/featureRequest";
import { PublicApiErrorSchema } from "../../../models/publicApi/publicApiError";
import { SearchRequestsResponseSchema } from "../../../models/publicApi/searchRequests";
import { callPublicApi, type PublicApiResponse } from "../support/publicApiClient";

const REQUESTER = { "X-Requester": "integration-test" };
const UNKNOWN_ULID = "00000000000000000000000000";
const ULID = /^[0-9A-HJKMNP-TV-Z]{26}$/;

function expectError(response: PublicApiResponse, status: number, code: string): void {
  expect(response.status).toBe(status);
  expect(PublicApiErrorSchema.parse(response.json).error.code).toBe(code);
  expect(response.headers.get("x-call-id")).toMatch(ULID);
}

describe.skipIf(process.env.INTEGRATION_TARGET === "local")("the public API against a live deployment", () => {
  it("rejects a call with no X-Requester, on any route", async () => {
    expectError(await callPublicApi("/v1/openapi.yaml", "GET", "/v1/openapi.yaml"), 400, "INVALID_REQUESTER");
  });

  it("serves the spec the repo holds", async () => {
    const response = await callPublicApi("/v1/openapi.yaml", "GET", "/v1/openapi.yaml", { headers: REQUESTER });
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/yaml");
    expect(response.headers.get("x-call-id")).toMatch(ULID);
    expect(response.text).toBe(readFileSync(join(__dirname, "../../../controller/web-api/publicV1/openapi.yaml"), "utf8"));
  });

  it("searches requests: a malformed id is a 400, an unknown one an empty page", async () => {
    const malformed = await callPublicApi("/v1/requests/search", "POST", "/v1/requests/search", {
      headers: REQUESTER,
      body: { search_params: { order_id: "not-an-id" } },
    });
    expectError(malformed, 400, "VALIDATION_ERROR");

    const unknown = await callPublicApi("/v1/requests/search", "POST", "/v1/requests/search", {
      headers: REQUESTER,
      body: { search_params: { order_id: UNKNOWN_ULID } },
    });
    expect(unknown.status).toBe(200);
    expect(SearchRequestsResponseSchema.parse(unknown.json)).toEqual({ items: [], next_cursor: null });
  });

  it("answers an unknown feature request with 404, and a malformed id with 400", async () => {
    expectError(await callPublicApi("/v1/feature-requests/{feature_request_id}", "GET", "/v1/feature-requests/nope", { headers: REQUESTER }), 400, "VALIDATION_ERROR");
    expectError(
      await callPublicApi("/v1/feature-requests/{feature_request_id}", "GET", `/v1/feature-requests/${UNKNOWN_ULID}`, { headers: REQUESTER }),
      404,
      "NOT_FOUND"
    );
  });

  it("rejects an invalid feature request without filing it", async () => {
    const response = await callPublicApi("/v1/feature-requests", "POST", "/v1/feature-requests", {
      headers: REQUESTER,
      body: { title: "Hi", description: "short", submitted_by: { name: "" } },
    });
    expectError(response, 400, "VALIDATION_ERROR");
  });

  it.skipIf(process.env.INTEGRATION_TARGET === "prod")(
    "files a feature request once per Idempotency-Key, and reads it back (Test only)",
    async () => {
      const headers = { ...REQUESTER, "Idempotency-Key": randomUUID() };
      const body = {
        title: "Integration test feature request",
        description: "Filed by the pipeline's integration suite; safe to ignore.",
        submitted_by: { name: "Integration Test", email: null },
      };

      const created = await callPublicApi("/v1/feature-requests", "POST", "/v1/feature-requests", { headers, body });
      expect(created.status).toBe(201);
      const featureRequest = FeatureRequestSchema.parse(created.json);
      expect(featureRequest).toMatchObject({ status: "RECEIVED", title: body.title, submitted_by: { name: "Integration Test" } });

      const replayed = await callPublicApi("/v1/feature-requests", "POST", "/v1/feature-requests", { headers, body });
      expect(replayed.status).toBe(201);
      expect(FeatureRequestSchema.parse(replayed.json).feature_request_id).toBe(featureRequest.feature_request_id);

      const fetched = await callPublicApi(
        "/v1/feature-requests/{feature_request_id}",
        "GET",
        `/v1/feature-requests/${featureRequest.feature_request_id}`,
        { headers: REQUESTER }
      );
      expect(fetched.status).toBe(200);
      expect(FeatureRequestSchema.parse(fetched.json)).toEqual(featureRequest);
    }
  );
});
