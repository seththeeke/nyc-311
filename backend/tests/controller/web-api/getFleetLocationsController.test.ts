import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getFleetLocationsController } from "../../../controller/web-api/getFleetLocationsController";
import { getFleetLocations } from "../../../service/fleet/fleetLocationService";
import type { FleetLocations } from "../../../models/fleetLocation";
import { HOME_DEPOT_LOCATION } from "../../../models/gpsLocation";

vi.mock("../../../service/fleet/fleetLocationService", () => ({ getFleetLocations: vi.fn() }));

const mockedGetFleetLocations = vi.mocked(getFleetLocations);

const validEvent = {
  rawPath: "/fleet/locations",
  requestContext: { http: { method: "GET" } },
};

const locations: FleetLocations = {
  operators: [{ operator_id: "01OPERATOR", name: "Truck 12", current_activity: "IDLE", current_location: HOME_DEPOT_LOCATION }],
};

beforeEach(() => {
  mockedGetFleetLocations.mockReset();
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("getFleetLocationsController", () => {
  it("returns 200 with the FleetLocations, no admin auth required", async () => {
    mockedGetFleetLocations.mockResolvedValue(locations);

    const result = await getFleetLocationsController(validEvent);

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body as string)).toEqual(locations);
  });

  it("returns 400 for a malformed event", async () => {
    const result = await getFleetLocationsController({ not: "an api gateway event" });

    expect(result.statusCode).toBe(400);
    expect(mockedGetFleetLocations).not.toHaveBeenCalled();
  });

  it("returns 500 for a service failure", async () => {
    mockedGetFleetLocations.mockRejectedValue(new Error("DynamoDB throttled"));

    const result = await getFleetLocationsController(validEvent);

    expect(result.statusCode).toBe(500);
  });

  it("returns 500 and logs a thrown non-Error value", async () => {
    mockedGetFleetLocations.mockRejectedValue("string rejection");

    const result = await getFleetLocationsController(validEvent);

    expect(result.statusCode).toBe(500);
  });
});
