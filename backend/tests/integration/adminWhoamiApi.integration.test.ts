/**
 * Real-integration tier (testing-framework.md §4) — hits the live
 * deployed API's `GET /admin/whoami`, the one admin-authorized route
 * (`9-admin-auth-integration.md` §8). Proves the JWT authorizer + `Users`
 * table wiring works end-to-end on a real deploy, not just in mocked unit
 * tests.
 *
 * Skipped for `INTEGRATION_TARGET=local`: `sam local start-api` doesn't
 * enforce HTTP API JWT authorizers at all, so neither the 200 nor the 401
 * case would carry any real signal against that target.
 */

import { describe, expect, it } from "vitest";
import { getJson } from "./support/httpClient";
import { getTestAdminIdToken } from "./support/testAdminAuth";
import { UserSchema } from "../../models/user";

const ROUTE = "/admin/whoami";

describe.skipIf(process.env.INTEGRATION_TARGET === "local")("GET /admin/whoami against a live API", () => {
  it("returns 200 with the test-admin's User record when a valid token is supplied", async () => {
    const idToken = await getTestAdminIdToken();

    const { status, body } = await getJson(ROUTE, ROUTE, { headers: { Authorization: `Bearer ${idToken}` } });

    expect(status).toBe(200);
    expect(() => UserSchema.parse(body)).not.toThrow();
  });

  it("returns 401 with no Authorization header at all", async () => {
    const { status } = await getJson(ROUTE, ROUTE);
    expect(status).toBe(401);
  });
});
