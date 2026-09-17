import type { GpsLocation } from "../../models/gpsLocation";
import { getDistance } from "./pathPlanningService";

/*
 * Pluggable interface (6-order-scheduling.md §5), matching
 * capacity-model.md §3.1's own shape. Takes just two GPS points — no
 * Order/Location/Operator coupling — per
 * 11-street-condition-implementation.md §5's deferred
 * operator-location-aware transit time: the caller resolves both the
 * operator's current position and the job's position before calling in.
 */
export interface TransitTimeEstimator {
  /** Minutes to travel from `from` to `to`. */
  estimateMinutes(from: GpsLocation, to: GpsLocation): Promise<number>;
}

const ASSUMED_SPEED_MPH = 25;
const MINIMUM_TRANSIT_MINUTES = 10;

/*
 * Rudimentary stand-in for the route inefficiency (bridges, detours,
 * one-ways) a straight line ignores over a genuinely long haul: every full
 * 25-mile bracket beyond the first tacks on another 10% of distance.
 */
const LONG_HAUL_BRACKET_MILES = 25;
const LONG_HAUL_PENALTY_PER_BRACKET = 0.1;

function applyLongHaulPenalty(distanceMiles: number): number {
  const bracketsOver = Math.floor(distanceMiles / LONG_HAUL_BRACKET_MILES);
  return distanceMiles * (1 + bracketsOver * LONG_HAUL_PENALTY_PER_BRACKET);
}

/**
 * v1 (rudimentary) implementation: straight-line lat/long distance
 * (`pathPlanningService.getDistance`) over an assumed flat driving speed,
 * with a long-haul distance penalty standing in for real path planning
 * (11-street-condition-implementation.md §3, still undecided).
 */
export const straightLineTransitTimeEstimator: TransitTimeEstimator = {
  async estimateMinutes(from: GpsLocation, to: GpsLocation): Promise<number> {
    const rawDistanceMiles = await getDistance(from, to);
    const adjustedDistanceMiles = applyLongHaulPenalty(rawDistanceMiles);
    const minutes = (adjustedDistanceMiles / ASSUMED_SPEED_MPH) * 60;
    return Math.max(minutes, MINIMUM_TRANSIT_MINUTES);
  },
};
