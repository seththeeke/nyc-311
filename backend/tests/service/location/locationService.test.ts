import { DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb";
import { mockClient } from "aws-sdk-client-mock";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LocationDao } from "../../../dao/location/locationDao";
import type { Location } from "../../../models/location";
import { getLocation } from "../../../service/location/locationService";

const location: Location = {
  location_id: "3011870001",
  bbl: "3011870001",
  address: "412 ATLANTIC AVENUE",
  borough: "BROOKLYN",
  community_board: "02 BROOKLYN",
  zip: "11217",
  latitude: "40.6862",
  longitude: "-73.9839",
  created_at: "2026-10-13T22:41:00.000Z",
};

function mockDao(found: Location | null): LocationDao {
  return { getLocation: vi.fn().mockResolvedValue(found) } as unknown as LocationDao;
}

const ddbMock = mockClient(DynamoDBDocumentClient);

beforeEach(() => {
  ddbMock.reset();
  vi.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("getLocation", () => {
  it("returns the Location", async () => {
    const locationDao = mockDao(location);
    await expect(getLocation(location.location_id, { locationDao })).resolves.toEqual(location);
    expect(locationDao.getLocation).toHaveBeenCalledWith(location.location_id);
  });

  it("returns null when no Location has that id", async () => {
    await expect(getLocation("9999999999", { locationDao: mockDao(null) })).resolves.toBeNull();
  });

  it("builds its own DAO from LOCATIONS_TABLE_NAME when none is given", async () => {
    ddbMock.on(GetCommand).resolves({});
    await expect(getLocation(location.location_id)).resolves.toBeNull();
    expect(ddbMock.commandCalls(GetCommand)[0].args[0].input.TableName).toBe("Locations");
  });
});
