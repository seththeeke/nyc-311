import { afterEach, describe, expect, it, vi } from "vitest";
import { capacityChangeOf, requireCapacityReader } from "../../../../controller/web-api/admin/capacityCaller";
import { TerminalError, ValidationError } from "../../../../models/errors";
import type { ApiGatewayHttpEvent } from "../../../../models/apiGatewayHttpEvent";

/* Keep the real module (and its User service) out of this worker; the resolver is injected below. */
vi.mock("../../../../controller/web-api/admin/requireAdminUser", () => ({ requireAdminUser: vi.fn() }));

const requireAdminUser = vi.fn().mockResolvedValue(undefined);

const event = (claims?: Record<string, string>): ApiGatewayHttpEvent => ({ rawPath: "/capacity", requestContext: { http: { method: "POST" }, ...(claims ? { authorizer: { jwt: { claims } } } : {}) } });
const COO = { sub: "s", email: "coo-agent@agents.boroughsim.com", "cognito:groups": "[BOROUGH_SIM_TEAM BOROUGH_SIM_OPERATIONS]" };
const ADMIN = { sub: "a", email: "admin@example.com", "cognito:groups": "[ADMIN BOROUGH_SIM_TEAM]" };

afterEach(() => {
  requireAdminUser.mockClear();
});

describe("capacityChangeOf", () => {
  it("makes the admin an ADMIN change with an optional reason, resolving the User", async () => {
    expect(await capacityChangeOf(event(ADMIN), undefined, requireAdminUser)).toEqual({ actor: "ADMIN", reason: null, by: "admin@example.com" });
    expect(await capacityChangeOf(event(ADMIN), "rebalancing", requireAdminUser)).toMatchObject({ reason: "rebalancing" });
    expect(requireAdminUser).toHaveBeenCalledTimes(2);
  });

  it("makes the COO an AGENT change that must carry a reason, with no User", async () => {
    expect(await capacityChangeOf(event(COO), "Median 2.6 days", requireAdminUser)).toEqual({ actor: "AGENT", reason: "Median 2.6 days", by: COO.email });
    await expect(capacityChangeOf(event(COO), undefined, requireAdminUser)).rejects.toBeInstanceOf(ValidationError);
    expect(requireAdminUser).not.toHaveBeenCalled();
  });

  it("refuses a token with no email", async () => {
    await expect(capacityChangeOf(event(), "x")).rejects.toBeInstanceOf(TerminalError);
  });
});

describe("requireCapacityReader", () => {
  it("resolves the admin to a User and lets the COO read without one", async () => {
    await requireCapacityReader(event(ADMIN), requireAdminUser);
    await requireCapacityReader(event(COO), requireAdminUser);
    await requireCapacityReader(event(), requireAdminUser);
    expect(requireAdminUser).toHaveBeenCalledOnce();
  });

  it("propagates the admin resolver's failure, so the controller answers 500", async () => {
    await expect(requireCapacityReader(event(ADMIN), vi.fn().mockRejectedValue(new Error("no claims")))).rejects.toThrow("no claims");
  });
});
