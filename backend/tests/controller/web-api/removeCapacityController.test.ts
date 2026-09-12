import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { removeCapacityController } from "../../../controller/web-api/removeCapacityController";
import { requireAdminUser } from "../../../controller/web-api/requireAdminUser";
import { removeCapacity } from "../../../service/capacity/capacityService";
import { NotFoundError, ValidationError } from "../../../models/errors";
import type { Operator } from "../../../models/operator";
import type { User } from "../../../models/user";

vi.mock("../../../controller/web-api/requireAdminUser", () => ({ requireAdminUser: vi.fn() }));
vi.mock("../../../service/capacity/capacityService", () => ({ removeCapacity: vi.fn() }));

const mockedRequireAdminUser = vi.mocked(requireAdminUser);
const mockedRemoveCapacity = vi.mocked(removeCapacity);

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

const operator: Operator = {
  operator_id: "01OPERATOR",
  status: "INACTIVE",
  current_activity: "IDLE",
  removal_requested_at: null,
  start_datetime: "2026-09-12T00:00:00.000Z",
  end_datetime: "2026-09-12T01:00:00.000Z",
  rate_per_hour: 45,
  last_event_sequence: 1,
};

const validEvent = {
  rawPath: "/capacity/01OPERATOR",
  requestContext: {
    http: { method: "DELETE" },
    authorizer: { jwt: { claims: { sub: "abc-123", email: "admin@example.com" } } },
  },
  pathParameters: { operator_id: "01OPERATOR" },
};

beforeEach(() => {
  mockedRequireAdminUser.mockReset();
  mockedRemoveCapacity.mockReset();
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("removeCapacityController", () => {
  it("returns 200 with the updated Operator", async () => {
    mockedRequireAdminUser.mockResolvedValue(admin);
    mockedRemoveCapacity.mockResolvedValue(operator);

    const result = await removeCapacityController(validEvent);

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body as string)).toEqual(operator);
    expect(mockedRemoveCapacity).toHaveBeenCalledWith("01OPERATOR");
  });

  it("returns 400 without calling requireAdminUser for a malformed event", async () => {
    const result = await removeCapacityController({ not: "an api gateway event" });

    expect(result.statusCode).toBe(400);
    expect(mockedRequireAdminUser).not.toHaveBeenCalled();
  });

  it("returns 400 when operator_id path parameter is missing", async () => {
    const result = await removeCapacityController({ ...validEvent, pathParameters: {} });

    expect(result.statusCode).toBe(400);
    expect(mockedRequireAdminUser).not.toHaveBeenCalled();
  });

  it("returns 400 when pathParameters is omitted entirely", async () => {
    const eventWithoutPathParameters = { ...validEvent };
    delete (eventWithoutPathParameters as { pathParameters?: unknown }).pathParameters;

    const result = await removeCapacityController(eventWithoutPathParameters);

    expect(result.statusCode).toBe(400);
    expect(mockedRequireAdminUser).not.toHaveBeenCalled();
  });

  it("returns 404 when the service throws NotFoundError", async () => {
    mockedRequireAdminUser.mockResolvedValue(admin);
    mockedRemoveCapacity.mockRejectedValue(new NotFoundError("no such Operator"));

    const result = await removeCapacityController(validEvent);

    expect(result.statusCode).toBe(404);
  });

  it("returns 400 when the service throws a ValidationError", async () => {
    mockedRequireAdminUser.mockResolvedValue(admin);
    mockedRemoveCapacity.mockRejectedValue(new ValidationError("already removed"));

    const result = await removeCapacityController(validEvent);

    expect(result.statusCode).toBe(400);
  });

  it("returns 500 for any other failure", async () => {
    mockedRequireAdminUser.mockResolvedValue(admin);
    mockedRemoveCapacity.mockRejectedValue(new Error("DynamoDB throttled"));

    const result = await removeCapacityController(validEvent);

    expect(result.statusCode).toBe(500);
  });

  it("returns 500 when requireAdminUser itself fails", async () => {
    mockedRequireAdminUser.mockRejectedValue(new Error("no claims"));

    const result = await removeCapacityController(validEvent);

    expect(result.statusCode).toBe(500);
    expect(mockedRemoveCapacity).not.toHaveBeenCalled();
  });

  it("returns 500 and logs a thrown non-Error value", async () => {
    mockedRequireAdminUser.mockResolvedValue(admin);
    mockedRemoveCapacity.mockRejectedValue("string rejection");

    const result = await removeCapacityController(validEvent);

    expect(result.statusCode).toBe(500);
  });
});
