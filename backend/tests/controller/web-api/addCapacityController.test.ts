import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { addCapacityController } from "../../../controller/web-api/addCapacityController";
import { requireAdminUser } from "../../../controller/web-api/requireAdminUser";
import { addCapacity } from "../../../service/capacity/capacityService";
import { ValidationError } from "../../../models/errors";
import type { Operator } from "../../../models/operator";
import { HOME_DEPOT_LOCATION } from "../../../models/gpsLocation";
import type { User } from "../../../models/user";

vi.mock("../../../controller/web-api/requireAdminUser", () => ({ requireAdminUser: vi.fn() }));
vi.mock("../../../service/capacity/capacityService", () => ({ addCapacity: vi.fn() }));

const mockedRequireAdminUser = vi.mocked(requireAdminUser);
const mockedAddCapacity = vi.mocked(addCapacity);

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
  name: "Truck 12",
  status: "ACTIVE",
  current_activity: "IDLE",
  removal_requested_at: null,
  start_datetime: "2026-09-12T00:00:00.000Z",
  end_datetime: null,
  rate_per_hour: 45,
  current_location: HOME_DEPOT_LOCATION,
  last_event_sequence: 0,
};

const validEvent = {
  rawPath: "/capacity",
  requestContext: {
    http: { method: "POST" },
    authorizer: { jwt: { claims: { sub: "abc-123", email: "admin@example.com" } } },
  },
  body: JSON.stringify({ name: "Truck 12", rate_per_hour: 45 }),
};

beforeEach(() => {
  mockedRequireAdminUser.mockReset();
  mockedAddCapacity.mockReset();
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("addCapacityController", () => {
  it("returns 201 with the new Operator", async () => {
    mockedRequireAdminUser.mockResolvedValue(admin);
    mockedAddCapacity.mockResolvedValue(operator);

    const result = await addCapacityController(validEvent);

    expect(result.statusCode).toBe(201);
    expect(JSON.parse(result.body as string)).toEqual(operator);
    expect(mockedAddCapacity).toHaveBeenCalledWith("Truck 12", 45);
  });

  it("passes undefined rate_per_hour through when the body omits it", async () => {
    mockedRequireAdminUser.mockResolvedValue(admin);
    mockedAddCapacity.mockResolvedValue(operator);

    await addCapacityController({ ...validEvent, body: JSON.stringify({ name: "Truck 12" }) });

    expect(mockedAddCapacity).toHaveBeenCalledWith("Truck 12", undefined);
  });

  it("returns 400 for a body missing the required name", async () => {
    const result = await addCapacityController({ ...validEvent, body: JSON.stringify({ rate_per_hour: 45 }) });

    expect(result.statusCode).toBe(400);
    expect(mockedRequireAdminUser).not.toHaveBeenCalled();
  });

  it("treats a missing body the same as an empty object (fails validation — name is required)", async () => {
    const result = await addCapacityController({ ...validEvent, body: null });

    expect(result.statusCode).toBe(400);
    expect(mockedAddCapacity).not.toHaveBeenCalled();
  });

  it("returns 400 without calling requireAdminUser for a malformed event", async () => {
    const result = await addCapacityController({ not: "an api gateway event" });

    expect(result.statusCode).toBe(400);
    expect(mockedRequireAdminUser).not.toHaveBeenCalled();
  });

  it("returns 400 for an unparsable JSON body", async () => {
    const result = await addCapacityController({ ...validEvent, body: "{not json" });

    expect(result.statusCode).toBe(400);
    expect(mockedRequireAdminUser).not.toHaveBeenCalled();
  });

  it("returns 400 for a body that fails schema validation", async () => {
    const result = await addCapacityController({
      ...validEvent,
      body: JSON.stringify({ name: "Truck 12", rate_per_hour: -5 }),
    });

    expect(result.statusCode).toBe(400);
    expect(mockedRequireAdminUser).not.toHaveBeenCalled();
  });

  it("returns 400 when the service throws a ValidationError", async () => {
    mockedRequireAdminUser.mockResolvedValue(admin);
    mockedAddCapacity.mockRejectedValue(new ValidationError("bad rate"));

    const result = await addCapacityController(validEvent);

    expect(result.statusCode).toBe(400);
  });

  it("returns 500 for any other failure", async () => {
    mockedRequireAdminUser.mockResolvedValue(admin);
    mockedAddCapacity.mockRejectedValue(new Error("DynamoDB throttled"));

    const result = await addCapacityController(validEvent);

    expect(result.statusCode).toBe(500);
  });

  it("returns 500 when requireAdminUser itself fails", async () => {
    mockedRequireAdminUser.mockRejectedValue(new Error("no claims"));

    const result = await addCapacityController(validEvent);

    expect(result.statusCode).toBe(500);
    expect(mockedAddCapacity).not.toHaveBeenCalled();
  });

  it("returns 500 and logs a thrown non-Error value", async () => {
    mockedRequireAdminUser.mockResolvedValue(admin);
    mockedAddCapacity.mockRejectedValue("string rejection");

    const result = await addCapacityController(validEvent);

    expect(result.statusCode).toBe(500);
  });
});
