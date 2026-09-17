import { HOME_DEPOT_LOCATION, type GpsLocation } from "../../models/gpsLocation";

/*
 * Distance calculation isolated behind its own function so a real
 * implementation (routing API, traffic-aware model —
 * 11-street-condition-implementation.md §3, still undecided) can replace
 * just this file later without touching transitTimeService's own logic.
 */

const MILES_PER_DEGREE_LATITUDE = 69;

/*
 * A degree of longitude shrinks toward the poles — at HOME_DEPOT_LOCATION's
 * latitude it's only cos(lat) as wide as a degree of latitude. Fixed to
 * that one reference latitude rather than each call's actual latitude — a
 * flat-earth approximation good enough at NYC's scale, not a true
 * great-circle (Haversine) calculation.
 */
const MILES_PER_DEGREE_LONGITUDE = MILES_PER_DEGREE_LATITUDE * Math.cos((HOME_DEPOT_LOCATION.lat * Math.PI) / 180);

/** Straight-line distance in miles between two GPS points. */
export async function getDistance(from: GpsLocation, to: GpsLocation): Promise<number> {
  const latMiles = (to.lat - from.lat) * MILES_PER_DEGREE_LATITUDE;
  const lngMiles = (to.lng - from.lng) * MILES_PER_DEGREE_LONGITUDE;
  return Math.sqrt(latMiles * latMiles + lngMiles * lngMiles);
}
