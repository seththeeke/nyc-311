import type { GpsLocation } from "../../models/fleetLocation";

/*
 * Web-mercator math for placing Three.js objects on the MapLibre map,
 * written out rather than imported from maplibre-gl so it stays pure and
 * testable. Scene space is metres around one origin: +x east, +y up,
 * +z south, matching the transform fleetLayer.ts hands Three.js.
 */

const EARTH_CIRCUMFERENCE_M = 2 * Math.PI * 6_371_008.8;
const TILE_SIZE_PX = 512;

export interface MercatorPoint {
  x: number;
  y: number;
}

export interface SceneOrigin {
  mercator: MercatorPoint;
  /** Mercator units per metre at the origin's latitude. */
  unitsPerMeter: number;
  lat: number;
}

export interface ScenePoint {
  x: number;
  z: number;
}

/** Midtown-ish, where the establishing shot centres. */
export const NYC_CENTER: GpsLocation = { lat: 40.7306, lng: -73.9866 };

export function toMercator({ lat, lng }: GpsLocation): MercatorPoint {
  const latRad = (lat * Math.PI) / 180;
  return {
    x: (lng + 180) / 360,
    y: (1 - Math.log(Math.tan(Math.PI / 4 + latRad / 2)) / Math.PI) / 2,
  };
}

export function createSceneOrigin(center: GpsLocation): SceneOrigin {
  return {
    mercator: toMercator(center),
    unitsPerMeter: 1 / (EARTH_CIRCUMFERENCE_M * Math.cos((center.lat * Math.PI) / 180)),
    lat: center.lat,
  };
}

export function toScene(location: GpsLocation, origin: SceneOrigin): ScenePoint {
  const m = toMercator(location);
  return {
    x: (m.x - origin.mercator.x) / origin.unitsPerMeter,
    z: (m.y - origin.mercator.y) / origin.unitsPerMeter,
  };
}

/** Great-circle-free flat distance, fine at city scale. */
export function distanceMeters(a: GpsLocation, b: GpsLocation): number {
  const metersPerDegLat = EARTH_CIRCUMFERENCE_M / 360;
  const metersPerDegLng = metersPerDegLat * Math.cos((((a.lat + b.lat) / 2) * Math.PI) / 180);
  return Math.hypot((b.lat - a.lat) * metersPerDegLat, (b.lng - a.lng) * metersPerDegLng);
}

/**
 * The Three.js Y rotation that points a model built facing +x along the
 * travel direction from `from` to `to`; `null` when they coincide.
 */
export function headingBetween(from: GpsLocation, to: GpsLocation): number | null {
  if (distanceMeters(from, to) < 0.5) return null;
  const east = to.lng - from.lng;
  const north = (to.lat - from.lat) / Math.cos((((from.lat + to.lat) / 2) * Math.PI) / 180);
  /* Scene +z is south, so a northward step is -z; rotating +x by θ about y lands on (cos θ, -sin θ). */
  return Math.atan2(north, east);
}

export function metersPerPixel(zoom: number, lat: number): number {
  return (EARTH_CIRCUMFERENCE_M * Math.cos((lat * Math.PI) / 180)) / (TILE_SIZE_PX * 2 ** zoom);
}
