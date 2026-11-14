import { afterEach, describe, expect, it, vi } from "vitest";
import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { LocationDao } from "../../../dao/location/locationDao";
import { getLocationDao } from "../../../dao/location/getLocationDao";

describe("getLocationDao", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("builds a new LocationDao on every call", () => {
    vi.stubEnv("LOCATIONS_TABLE_NAME", "Locations-Test");
    const dao = getLocationDao();
    expect(dao).toBeInstanceOf(LocationDao);
    expect(getLocationDao()).not.toBe(dao);
  });

  it("uses the client it is given", async () => {
    vi.stubEnv("LOCATIONS_TABLE_NAME", "Locations-Test");
    const send = vi.fn().mockResolvedValue({});
    await getLocationDao({ send } as unknown as DynamoDBDocumentClient).getLocation("location-1");
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ input: expect.objectContaining({ TableName: "Locations-Test" }) }));
  });

  it("throws when LOCATIONS_TABLE_NAME is missing", () => {
    vi.stubEnv("LOCATIONS_TABLE_NAME", "");
    expect(() => getLocationDao()).toThrow("LOCATIONS_TABLE_NAME");
  });
});
