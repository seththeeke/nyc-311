import { describe, expect, it } from "vitest";
import { createSceneOrigin, distanceMeters, headingBetween, metersPerPixel, NYC_CENTER, toMercator, toScene } from "../../../src/components/mapv2/geo";

describe("toMercator", () => {
  it("maps the null island to the middle of the world and longitude linearly", () => {
    expect(toMercator({ lat: 0, lng: 0 })).toEqual({ x: 0.5, y: 0.5 });
    expect(toMercator({ lat: 0, lng: 180 }).x).toBe(1);
  });

  it("puts northern latitudes above the middle (smaller y)", () => {
    expect(toMercator(NYC_CENTER).y).toBeLessThan(0.5);
  });
});

describe("toScene", () => {
  const origin = createSceneOrigin(NYC_CENTER);

  it("places the origin at zero and records its latitude", () => {
    const at = toScene(NYC_CENTER, origin);
    expect(at.x).toBeCloseTo(0);
    expect(at.z).toBeCloseTo(0);
    expect(origin.lat).toBe(NYC_CENTER.lat);
  });

  it("puts east at +x and north at -z, in metres", () => {
    const east = toScene({ lat: NYC_CENTER.lat, lng: NYC_CENTER.lng + 0.01 }, origin);
    const north = toScene({ lat: NYC_CENTER.lat + 0.01, lng: NYC_CENTER.lng }, origin);
    expect(east.x).toBeGreaterThan(800);
    expect(east.x).toBeLessThan(900);
    expect(north.z).toBeLessThan(-1000);
  });
});

describe("distanceMeters", () => {
  it("measures about 111 km per degree of latitude", () => {
    expect(distanceMeters({ lat: 40, lng: -74 }, { lat: 41, lng: -74 })).toBeCloseTo(111_195, -2);
  });
});

describe("headingBetween", () => {
  const from = { lat: 40.7, lng: -74 };

  it("is 0 heading east and π/2 heading north", () => {
    expect(headingBetween(from, { lat: 40.7, lng: -73.99 })).toBeCloseTo(0);
    expect(headingBetween(from, { lat: 40.71, lng: -74 })).toBeCloseTo(Math.PI / 2);
  });

  it("is null when the points coincide", () => {
    expect(headingBetween(from, from)).toBeNull();
  });
});

describe("metersPerPixel", () => {
  it("halves with every zoom level", () => {
    expect(metersPerPixel(13, 40) / metersPerPixel(14, 40)).toBeCloseTo(2);
  });
});
