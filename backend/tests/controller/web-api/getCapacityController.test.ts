import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getCapacityController } from "../../../controller/web-api/getCapacityController";
import { requireAdminUser } from "../../../controller/web-api/requireAdminUser";
import { getCapacityStatus } from "../../../service/capacity/capacityService";
import { ValidationError } from "../../../models/errors";
import type { CapacityStatus } from "../../../models/capacityStatus";
import type { User } from "../../../models/user";

vi.mock("../../../controller/web-api/requireAdminUser", () => ({ requireAdminUser: vi.fn() }));
vi.mock("../../../service/capacity/capacityService", () => ({ getCapacityStatus: vi.fn() }));

const mockedRequireAdminUser = vi.mocked(requireAdminUser);
const mockedGetCapacityStatus = vi.mocked(getCapacityStatus);

const admin: User = {
  user_id: "01ADMIN",
  type: "ADMIN",
  status: "ACTIVE",
  created_at: "2026-09-10T00:00:00.000Z",
  updated_at: "2026-09-10T00:00:00.000Z",
  last_active_at: "2026-09-10T00:00:00.000Z",
  cognito_sub: "abc-123",
  email: "admin@example.com",
  display_name: null,
};

const status: CapacityStatus = { available_count: 1, fleet_size: 1, hourly_burn_rate: 45, roster: [] };

const validEvent = {
  rawPath: "/capacity",
  requestContext: {
    http: { method: "GET" },
    authorizer: { jwt: { claims: { sub: "abc-123", email: "admin@example.com" } } },
  },
};

beforeEach(() => {
  mockedRequireAdminUser.mockReset();
  mockedGetCapacityStatus.mockReset();
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("getCapacityController", () => {
  it("returns 200 with the CapacityStatus", async () => {
    mockedRequireAdminUser.mockResolvedValue(admin);
    mockedGetCapacityStatus.mockResolvedValue(status);

    const result = await getCapacityController(validEvent);

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body as string)).toEqual(status);
  });

  it("returns 400 without calling requireAdminUser for a malformed event", async () => {
    const result = await getCapacityController({ not: "an api gateway event" });

    expect(result.statusCode).toBe(400);
    expect(mockedRequireAdminUser).not.toHaveBeenCalled();
  });

  it("returns 400 when the service throws a ValidationError", async () => {
    mockedRequireAdminUser.mockResolvedValue(admin);
    mockedGetCapacityStatus.mockRejectedValue(new ValidationError("bad roster item"));

    const result = await getCapacityController(validEvent);

    expect(result.statusCode).toBe(400);
  });

  it("returns 500 for any other failure", async () => {
    mockedRequireAdminUser.mockResolvedValue(admin);
    mockedGetCapacityStatus.mockRejectedValue(new Error("DynamoDB throttled"));

    const result = await getCapacityController(validEvent);

    expect(result.statusCode).toBe(500);
  });

  it("returns 500 when requireAdminUser itself fails", async () => {
    mockedRequireAdminUser.mockRejectedValue(new Error("no claims"));

    const result = await getCapacityController(validEvent);

    expect(result.statusCode).toBe(500);
    expect(mockedGetCapacityStatus).not.toHaveBeenCalled();
  });

  it("returns 500 and logs a thrown non-Error value", async () => {
    mockedRequireAdminUser.mockResolvedValue(admin);
    mockedGetCapacityStatus.mockRejectedValue("string rejection");

    const result = await getCapacityController(validEvent);

    expect(result.statusCode).toBe(500);
  });
});
