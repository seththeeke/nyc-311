import { describe, expect, it } from "vitest";
import { isAgentCaller } from "../../../../controller/web-api/admin/isAgentCaller";
import type { ApiGatewayHttpEvent } from "../../../../models/apiGatewayHttpEvent";

function event(groups?: string): ApiGatewayHttpEvent {
  return { rawPath: "/x", requestContext: { http: { method: "GET" }, authorizer: { jwt: { claims: { sub: "s", email: "e", ...(groups ? { "cognito:groups": groups } : {}) } } } } };
}

describe("isAgentCaller", () => {
  it("is true only for an agent group without ADMIN", () => {
    expect(isAgentCaller(event("[BOROUGH_SIM_TEAM BOROUGH_SIM_PRODUCT]"))).toBe(true);
    expect(isAgentCaller(event("[BOROUGH_SIM_TEAM BOROUGH_SIM_OPERATIONS]"))).toBe(true);
    expect(isAgentCaller(event("[ADMIN BOROUGH_SIM_PRODUCT]"))).toBe(false);
    expect(isAgentCaller(event("[BOROUGH_SIM_TEAM]"))).toBe(false);
    expect(isAgentCaller(event())).toBe(false);
    expect(isAgentCaller({ rawPath: "/x", requestContext: { http: { method: "GET" } } })).toBe(false);
  });
});
