import { describe, expect, it } from "vitest";
import { getDistance } from "../../../service/scheduling/pathPlanningService";
import { HOME_DEPOT_LOCATION } from "../../../models/gpsLocation";

describe("getDistance", () => {
  it("returns 0 for two identical points", async () => {
    await expect(getDistance(HOME_DEPOT_LOCATION, HOME_DEPOT_LOCATION)).resolves.toBe(0);
  });

  it("converts a pure latitude difference using ~69 miles per degree", async () => {
    const from = { lat: 40.0, lng: -74.0 };
    const to = { lat: 41.0, lng: -74.0 };

    const miles = await getDistance(from, to);

    expect(miles).toBeCloseTo(69, 0);
  });

  it("converts a pure longitude difference, shrunk by cos(latitude) versus a degree of latitude", async () => {
    const from = { lat: HOME_DEPOT_LOCATION.lat, lng: -74.0 };
    const to = { lat: HOME_DEPOT_LOCATION.lat, lng: -73.0 };

    const miles = await getDistance(from, to);

    expect(miles).toBeGreaterThan(50);
    expect(miles).toBeLessThan(69);
  });

  it("is symmetric regardless of argument order", async () => {
    const a = { lat: 40.75, lng: -73.82 };
    const b = HOME_DEPOT_LOCATION;

    await expect(getDistance(a, b)).resolves.toBeCloseTo(await getDistance(b, a), 10);
  });

  it("combines lat and lng deltas via the Pythagorean distance", async () => {
    const from = { lat: 40.0, lng: -74.0 };
    const to = { lat: 41.0, lng: -73.0 };

    const miles = await getDistance(from, to);
    const latOnly = await getDistance(from, { lat: 41.0, lng: -74.0 });
    const lngOnly = await getDistance(from, { lat: 40.0, lng: -73.0 });

    expect(miles).toBeCloseTo(Math.sqrt(latOnly * latOnly + lngOnly * lngOnly), 6);
  });
});
