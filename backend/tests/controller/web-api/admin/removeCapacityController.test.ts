import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { removeCapacityController } from "../../../../controller/web-api/admin/removeCapacityController";
import { capacityChangeOf } from "../../../../controller/web-api/admin/capacityCaller";
import { removeCapacity } from "../../../../service/capacity/capacityService";
import { ConflictError, NotFoundError, ValidationError } from "../../../../models/errors";
import type { Operator } from "../../../../models/operator";
import { HOME_DEPOT_LOCATION } from "../../../../models/gpsLocation";

vi.mock("../../../../controller/web-api/admin/capacityCaller", () => ({ capacityChangeOf: vi.fn() }));
vi.mock("../../../../service/capacity/capacityService", () => ({ removeCapacity: vi.fn() }));

const mockedRequireAdminUser = vi.mocked(capacityChangeOf);
const ADMIN_CHANGE = { actor: "ADMIN" as const, reason: null, by: "admin@example.com" };
const mockedRemoveCapacity = vi.mocked(removeCapacity);


const operator: Operator = {
  operator_id: "01OPERATOR",
  name: "Truck 12",
  status: "INACTIVE",
  current_activity: "IDLE",
  removal_requested_at: null,
  start_datetime: "2026-09-12T00:00:00.000Z",
  end_datetime: "2026-09-12T01:00:00.000Z",
  rate_per_hour: 45,
  current_location: HOME_DEPOT_LOCATION,
  last_event_sequence: 1,
};

const validEvent = {
  rawPath: "/capacity/01OPERATOR",
  requestContext: {
    http: { method: "DELETE" },
    authorizer: { jwt: { claims: { sub: "abc-123", email: "admin@example.com", "cognito:groups": "[ADMIN]" } } },
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
    mockedRequireAdminUser.mockResolvedValue(ADMIN_CHANGE);
    mockedRemoveCapacity.mockResolvedValue(operator);

    const result = await removeCapacityController(validEvent);

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body as string)).toEqual(operator);
    expect(mockedRemoveCapacity).toHaveBeenCalledWith("01OPERATOR", {}, { actor: "ADMIN", reason: null, by: "admin@example.com" });
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
    mockedRequireAdminUser.mockResolvedValue(ADMIN_CHANGE);
    mockedRemoveCapacity.mockRejectedValue(new NotFoundError("no such Operator"));

    const result = await removeCapacityController(validEvent);

    expect(result.statusCode).toBe(404);
  });

  it("returns 400 when the service throws a ValidationError", async () => {
    mockedRequireAdminUser.mockResolvedValue(ADMIN_CHANGE);
    mockedRemoveCapacity.mockRejectedValue(new ValidationError("already removed"));

    const result = await removeCapacityController(validEvent);

    expect(result.statusCode).toBe(400);
  });

  it("returns 500 for any other failure", async () => {
    mockedRequireAdminUser.mockResolvedValue(ADMIN_CHANGE);
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
    mockedRequireAdminUser.mockResolvedValue(ADMIN_CHANGE);
    mockedRemoveCapacity.mockRejectedValue("string rejection");

    const result = await removeCapacityController(validEvent);

    expect(result.statusCode).toBe(500);
  });
});

describe("removeCapacityController for the COO (docs/17-executive-team.md §12.3)", () => {
  const withBody = (body: string | null) => ({ ...validEvent, body });

  it("passes the body's reason to the caller check", async () => {
    mockedRequireAdminUser.mockResolvedValue({ actor: "AGENT", reason: "Idle 3 days", by: "coo-agent@agents.boroughsim.com" });
    mockedRemoveCapacity.mockResolvedValue(operator);
    expect((await removeCapacityController(withBody(JSON.stringify({ reason: "Idle 3 days" })))).statusCode).toBe(200);
    expect(mockedRequireAdminUser).toHaveBeenCalledWith(expect.anything(), "Idle 3 days");
  });

  it("returns 400 for a malformed or invalid body, or a missing reason, and 409 at the daily cap", async () => {
    expect((await removeCapacityController(withBody("{nope"))).statusCode).toBe(400);
    expect((await removeCapacityController(withBody(JSON.stringify({ reason: "" })))).statusCode).toBe(400);
    mockedRequireAdminUser.mockRejectedValueOnce(new ValidationError("An agent must give a reason for a capacity change"));
    expect(JSON.parse((await removeCapacityController(withBody(null))).body as string)).toEqual({ message: "An agent must give a reason for a capacity change" });
    mockedRequireAdminUser.mockResolvedValue(ADMIN_CHANGE);
    mockedRemoveCapacity.mockRejectedValueOnce(new ConflictError("Daily release limit reached: 2 of 2 today"));
    const capped = await removeCapacityController(withBody(JSON.stringify({ reason: "Idle" })));
    expect(capped.statusCode).toBe(409);
    expect(JSON.parse(capped.body as string)).toEqual({ message: "Daily release limit reached: 2 of 2 today" });
  });
});
