import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { requireAdminUser } from "../../../controller/web-api/requireAdminUser";
import { whoamiController } from "../../../controller/web-api/whoamiController";
import { TerminalError, ValidationError } from "../../../models/errors";
import type { User } from "../../../models/user";

vi.mock("../../../controller/web-api/requireAdminUser", () => ({
  requireAdminUser: vi.fn(),
}));

const mockedRequireAdminUser = vi.mocked(requireAdminUser);

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

const validEvent = {
  rawPath: "/admin/whoami",
  requestContext: {
    http: { method: "GET" },
    authorizer: { jwt: { claims: { sub: "abc-123", email: "admin@example.com" } } },
  },
};

beforeEach(() => {
  mockedRequireAdminUser.mockReset();
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("whoamiController", () => {
  it("returns 200 with the resolved User", async () => {
    mockedRequireAdminUser.mockResolvedValue(user);

    const result = await whoamiController(validEvent);

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body as string)).toEqual(user);
  });

  it("returns 400 without calling requireAdminUser for a malformed event", async () => {
    const result = await whoamiController({ not: "an api gateway event" });

    expect(result.statusCode).toBe(400);
    expect(mockedRequireAdminUser).not.toHaveBeenCalled();
  });

  it("returns 400 when requireAdminUser throws a ValidationError", async () => {
    mockedRequireAdminUser.mockRejectedValue(new ValidationError("bad claims"));

    const result = await whoamiController(validEvent);

    expect(result.statusCode).toBe(400);
  });

  it("returns 500 when requireAdminUser throws a TerminalError", async () => {
    mockedRequireAdminUser.mockRejectedValue(new TerminalError("missing claims"));

    const result = await whoamiController(validEvent);

    expect(result.statusCode).toBe(500);
  });

  it("returns 500 and logs a thrown non-Error value", async () => {
    mockedRequireAdminUser.mockRejectedValue("string rejection");

    const result = await whoamiController(validEvent);

    expect(result.statusCode).toBe(500);
  });
});
