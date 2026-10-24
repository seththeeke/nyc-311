import { describe, expect, it } from "vitest";
import { ApiRouterEventSchema } from "../../models/apiRouterEvent";

describe("ApiRouterEventSchema", () => {
  it("accepts a public event with no authorizer, ignoring extra fields", () => {
    const parsed = ApiRouterEventSchema.parse({ routeKey: "GET /feature-flags", rawPath: "/feature-flags", requestContext: {} });

    expect(parsed).toEqual({ routeKey: "GET /feature-flags", requestContext: {} });
  });

  it("keeps JWT claims when present", () => {
    const parsed = ApiRouterEventSchema.parse({
      routeKey: "GET /admin/whoami",
      requestContext: { authorizer: { jwt: { claims: { sub: "abc", email: "a@b.c" }, scopes: null } } },
    });

    expect(parsed.requestContext.authorizer?.jwt.claims).toEqual({ sub: "abc", email: "a@b.c" });
  });

  it("rejects an empty or missing routeKey", () => {
    expect(ApiRouterEventSchema.safeParse({ routeKey: "", requestContext: {} }).success).toBe(false);
    expect(ApiRouterEventSchema.safeParse({ requestContext: {} }).success).toBe(false);
  });
});
