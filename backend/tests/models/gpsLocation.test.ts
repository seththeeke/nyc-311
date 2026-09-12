import { describe, expect, it } from "vitest";
import { GpsLocationSchema, HOME_DEPOT_LOCATION } from "../../models/gpsLocation";

describe("GpsLocationSchema", () => {
  it("accepts a well-formed lat/lng pair", () => {
    const location = { lat: 40.7128, lng: -74.006 };
    expect(GpsLocationSchema.parse(location)).toEqual(location);
  });

  it("rejects a non-numeric lat", () => {
    expect(GpsLocationSchema.safeParse({ lat: "40.7128", lng: -74.006 }).success).toBe(false);
  });

  it("rejects a missing lng", () => {
    expect(GpsLocationSchema.safeParse({ lat: 40.7128 }).success).toBe(false);
  });
});

describe("HOME_DEPOT_LOCATION", () => {
  it("is itself a valid GpsLocation", () => {
    expect(GpsLocationSchema.safeParse(HOME_DEPOT_LOCATION).success).toBe(true);
  });
});
