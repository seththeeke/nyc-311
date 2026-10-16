import type { GpsLocation } from "../../models/fleetLocation";
import { distanceMeters, headingBetween } from "./geo";

/*
 * How a truck moves between polls. The API gives a snapshot, never a
 * route, so a truck only ever glides straight from where it was drawn to
 * where the latest poll puts it — it never invents a path.
 */

const MIN_GLIDE_MS = 1_500;
const MAX_GLIDE_MS = 9_000;
/** A city-street pace, so a short hop is quick and a cross-town jump still lands before the next poll. */
const GLIDE_SPEED_M_PER_S = 14;

export interface TruckMotion {
  from: GpsLocation;
  to: GpsLocation;
  startedAt: number;
  durationMs: number;
  /** Three.js Y rotation; kept when a poll doesn't move the truck. */
  heading: number;
}

export interface MotionSample {
  location: GpsLocation;
  heading: number;
  /** 0..1 through the current glide; 1 when parked. */
  progress: number;
  isMoving: boolean;
}

/** Smooth start and stop, so a glide reads as driving rather than sliding. */
export function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

export function glideDurationMs(from: GpsLocation, to: GpsLocation): number {
  const ms = (distanceMeters(from, to) / GLIDE_SPEED_M_PER_S) * 1000;
  return Math.min(MAX_GLIDE_MS, Math.max(MIN_GLIDE_MS, ms));
}

/** A parked truck, facing along its last job → current position when it has one. */
export function createMotion(location: GpsLocation, previousJob: GpsLocation | null, now: number): TruckMotion {
  const heading = (previousJob && headingBetween(previousJob, location)) ?? 0;
  return { from: location, to: location, startedAt: now, durationMs: 0, heading };
}

export function sampleMotion(motion: TruckMotion, now: number): MotionSample {
  const raw = motion.durationMs === 0 ? 1 : (now - motion.startedAt) / motion.durationMs;
  const progress = Math.min(1, Math.max(0, raw));
  const eased = easeInOutCubic(progress);
  return {
    location: {
      lat: motion.from.lat + (motion.to.lat - motion.from.lat) * eased,
      lng: motion.from.lng + (motion.to.lng - motion.from.lng) * eased,
    },
    heading: motion.heading,
    progress,
    isMoving: progress < 1,
  };
}

/**
 * Re-aims a truck at a new poll position, starting from wherever it's
 * drawn right now so a mid-glide update never teleports. Returns the same
 * object when the target hasn't changed.
 */
export function retargetMotion(motion: TruckMotion, target: GpsLocation, now: number): TruckMotion {
  if (target.lat === motion.to.lat && target.lng === motion.to.lng) return motion;
  const current = sampleMotion(motion, now).location;
  const heading = headingBetween(current, target) ?? motion.heading;
  return { from: current, to: target, startedAt: now, durationMs: glideDurationMs(current, target), heading };
}
