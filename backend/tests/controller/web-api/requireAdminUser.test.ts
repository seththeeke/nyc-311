import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getOrCreateUser } from "../../../service/user/userService";
import { requireAdminUser } from "../../../controller/web-api/requireAdminUser";
import { TerminalError } from "../../../models/errors";
import type { ApiGatewayHttpEvent } from "../../../models/apiGatewayHttpEvent";
import type { User } from "../../../models/user";

vi.mock("../../../service/user/userService", () => ({
  getOrCreateUser: vi.fn(),
}));

const mockedGetOrCreateUser = vi.mocked(getOrCreateUser);

const user: User = {
  user_id: "01H0000000000000000000001",
  type: "ADMIN",
  status: "ACTIVE",
  created_at: "2026-09-10T00:00:00.000Z",
  updated_at: "2026-09-10T00:00:00.000Z",
  last_active_at: "2026-09-10T00:00:00.000Z",
  cognito_sub: "abc-123",
  email: "admin@example.com",
  display_name: null,
};

const authorizedEvent: ApiGatewayHttpEvent = {
  rawPath: "/admin/whoami",
  requestContext: {
    http: { method: "GET" },
    authorizer: { jwt: { claims: { sub: "abc-123", email: "admin@example.com" } } },
  },
};

beforeEach(() => {
  mockedGetOrCreateUser.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("requireAdminUser", () => {
  it("resolves sub/email claims to a User via getOrCreateUser", async () => {
    mockedGetOrCreateUser.mockResolvedValue(user);

    await expect(requireAdminUser(authorizedEvent)).resolves.toEqual(user);
    expect(mockedGetOrCreateUser).toHaveBeenCalledWith("abc-123", "admin@example.com");
  });

  it("throws TerminalError when the authorizer block is entirely absent", async () => {
    const unauthorizedEvent: ApiGatewayHttpEvent = {
      rawPath: "/admin/whoami",
      requestContext: { http: { method: "GET" } },
    };

    await expect(requireAdminUser(unauthorizedEvent)).rejects.toBeInstanceOf(TerminalError);
    expect(mockedGetOrCreateUser).not.toHaveBeenCalled();
  });

  it("throws TerminalError when sub is missing from claims", async () => {
    const missingSub: ApiGatewayHttpEvent = {
      rawPath: "/admin/whoami",
      requestContext: { http: { method: "GET" }, authorizer: { jwt: { claims: { email: "admin@example.com" } } } },
    };

    await expect(requireAdminUser(missingSub)).rejects.toBeInstanceOf(TerminalError);
  });

  it("throws TerminalError when email is missing from claims", async () => {
    const missingEmail: ApiGatewayHttpEvent = {
      rawPath: "/admin/whoami",
      requestContext: { http: { method: "GET" }, authorizer: { jwt: { claims: { sub: "abc-123" } } } },
    };

    await expect(requireAdminUser(missingEmail)).rejects.toBeInstanceOf(TerminalError);
  });
});
