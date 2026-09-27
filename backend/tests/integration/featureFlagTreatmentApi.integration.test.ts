/**
 * Real-integration tier (testing-framework.md §4) — exercises the live
 * `POST /feature-flags/{flag_key}/treatment` route
 * (`11-street-condition-implementation.md` §4). Creates a throwaway flag
 * through the admin API, checks that getTreatment honors an override and a
 * 100% allocation, then deletes it.
 *
 * Skipped for `INTEGRATION_TARGET=local`: creating the flag needs the admin
 * JWT authorizer, which `sam local start-api` doesn't enforce.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sendJson } from "./support/httpClient";
import { getTestAdminIdToken } from "./support/testAdminAuth";
import { FeatureFlagSchema } from "../../models/featureFlag";

const TREATMENT_ROUTE = "/feature-flags/{flag_key}/treatment";
const FLAG_KEY = `INTEGRATION_TEST_${Date.now()}`;
const PINNED_OPERATOR_ID = "integration-test-pinned-operator";

function treatmentPath(flagKey: string): string {
  return `/feature-flags/${flagKey}/treatment`;
}

describe.skipIf(process.env.INTEGRATION_TARGET === "local")("POST /feature-flags/{flag_key}/treatment against a live API", () => {
  let authHeaders: Record<string, string> = {};
  let created = false;

  beforeAll(async () => {
    authHeaders = { Authorization: `Bearer ${await getTestAdminIdToken()}` };
    const { status, body } = await sendJson("/admin/feature-flags", "/admin/feature-flags", "POST", {
      headers: authHeaders,
      body: {
        flag_key: FLAG_KEY,
        description: "Throwaway flag created by the integration suite; safe to delete.",
        treatments: ["CONTROL", "EXPERIMENT", "PINNED"],
        default_treatment: "CONTROL",
        overrides: [{ entity_type: "OPERATOR", entity_id: PINNED_OPERATOR_ID, treatment: "PINNED" }],
        allocations: [{ treatment: "EXPERIMENT", percent: 100 }],
      },
    });
    expect(status).toBe(201);
    expect(FeatureFlagSchema.parse(body).version).toBe(1);
    created = true;
  });

  afterAll(async () => {
    if (!created) return;
    const { status } = await sendJson("/admin/feature-flags/{flag_key}", `/admin/feature-flags/${FLAG_KEY}`, "DELETE", {
      headers: authHeaders,
    });
    expect(status).toBe(204);
  });

  /* Runs first so the route report's last recorded hit for this route is a success. */
  it("returns 404 for a flag that doesn't exist", async () => {
    const { status } = await sendJson(TREATMENT_ROUTE, treatmentPath("INTEGRATION_TEST_MISSING_FLAG"), "POST", {
      body: { context: {} },
    });
    expect(status).toBe(404);
  });

  it("returns 400 for an unsupported context field", async () => {
    const { status } = await sendJson(TREATMENT_ROUTE, treatmentPath(FLAG_KEY), "POST", {
      body: { context: { unsupported_id: "x" } },
    });
    expect(status).toBe(400);
  });

  it("returns the override treatment for an allow-listed operator", async () => {
    const { status, body } = await sendJson(TREATMENT_ROUTE, treatmentPath(FLAG_KEY), "POST", {
      body: { context: { operator_id: PINNED_OPERATOR_ID } },
    });
    expect(status).toBe(200);
    expect(body).toEqual({ flag_key: FLAG_KEY, treatment: "PINNED" });
  });

  it("returns the 100%-allocated treatment for any other caller, without auth", async () => {
    for (const context of [{ operator_id: "some-other-operator" }, {}]) {
      const { status, body } = await sendJson(TREATMENT_ROUTE, treatmentPath(FLAG_KEY), "POST", { body: { context } });
      expect(status).toBe(200);
      expect(body).toEqual({ flag_key: FLAG_KEY, treatment: "EXPERIMENT" });
    }
  });
});
