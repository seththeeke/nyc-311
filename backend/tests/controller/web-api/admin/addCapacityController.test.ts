import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { addCapacityController } from "../../../../controller/web-api/admin/addCapacityController";
import { capacityChangeOf } from "../../../../controller/web-api/admin/capacityCaller";
import { addCapacity } from "../../../../service/capacity/capacityService";
import { ConflictError, ValidationError } from "../../../../models/errors";
import type { Operator } from "../../../../models/operator";
import { HOME_DEPOT_LOCATION } from "../../../../models/gpsLocation";

vi.mock("../../../../controller/web-api/admin/capacityCaller", () => ({ capacityChangeOf: vi.fn() }));
vi.mock("../../../../service/capacity/capacityService", () => ({ addCapacity: vi.fn() }));

const mockedRequireAdminUser = vi.mocked(capacityChangeOf);
const ADMIN_CHANGE = { actor: "ADMIN" as const, reason: null, by: "admin@example.com" };
const mockedAddCapacity = vi.mocked(addCapacity);


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
    authorizer: { jwt: { claims: { sub: "abc-123", email: "admin@example.com", "cognito:groups": "[ADMIN]" } } },
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
    mockedRequireAdminUser.mockResolvedValue(ADMIN_CHANGE);
    mockedAddCapacity.mockResolvedValue(operator);

    const result = await addCapacityController(validEvent);

    expect(result.statusCode).toBe(201);
    expect(JSON.parse(result.body as string)).toEqual(operator);
    expect(mockedAddCapacity).toHaveBeenCalledWith("Truck 12", 45, {}, { actor: "ADMIN", reason: null, by: "admin@example.com" });
  });

  it("passes undefined rate_per_hour through when the body omits it", async () => {
    mockedRequireAdminUser.mockResolvedValue(ADMIN_CHANGE);
    mockedAddCapacity.mockResolvedValue(operator);

    await addCapacityController({ ...validEvent, body: JSON.stringify({ name: "Truck 12" }) });

    expect(mockedAddCapacity).toHaveBeenCalledWith("Truck 12", undefined, {}, { actor: "ADMIN", reason: null, by: "admin@example.com" });
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
    mockedRequireAdminUser.mockResolvedValue(ADMIN_CHANGE);
    mockedAddCapacity.mockRejectedValue(new ValidationError("bad rate"));

    const result = await addCapacityController(validEvent);

    expect(result.statusCode).toBe(400);
  });

  it("returns 500 for any other failure", async () => {
    mockedRequireAdminUser.mockResolvedValue(ADMIN_CHANGE);
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
    mockedRequireAdminUser.mockResolvedValue(ADMIN_CHANGE);
    mockedAddCapacity.mockRejectedValue("string rejection");

    const result = await addCapacityController(validEvent);

    expect(result.statusCode).toBe(500);
  });
});

describe("addCapacityController for the COO (docs/17-executive-team.md §12.3)", () => {
  it("passes the reason to the caller check and returns 409 at the daily cap", async () => {
    mockedRequireAdminUser.mockResolvedValue({ actor: "AGENT", reason: "Median 2.6 days", by: "coo-agent@agents.boroughsim.com" });
    mockedAddCapacity.mockRejectedValueOnce(new ConflictError("Daily recruit limit reached: 2 of 2 today"));
    const response = await addCapacityController({ ...validEvent, body: JSON.stringify({ name: "Truck 13", reason: "Median 2.6 days" }) });
    expect(response.statusCode).toBe(409);
    expect(mockedRequireAdminUser).toHaveBeenCalledWith(expect.anything(), "Median 2.6 days");
  });
});
