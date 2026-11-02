import type { GpsLocation } from "../../models/fleetLocation";
import type { ActorAnchor } from "./three/fleetScene";

/* Screen-space click picking: the truck drawn nearest the click wins, within a forgiving radius. */

export const PICK_RADIUS_PX = 34;

export interface ScreenPoint {
  x: number;
  y: number;
}

/** @returns The picked Operator's id, or `null` when nothing is within `radiusPx`. */
export function pickNearest(
  anchors: ActorAnchor[],
  project: (location: GpsLocation) => ScreenPoint,
  click: ScreenPoint,
  radiusPx = PICK_RADIUS_PX
): string | null {
  let best: { id: string; distance: number } | null = null;
  for (const anchor of anchors) {
    const at = project(anchor.location);
    const distance = Math.hypot(at.x - click.x, at.y - click.y);
    if (distance <= radiusPx && (!best || distance < best.distance)) best = { id: anchor.operatorId, distance };
  }
  return best?.id ?? null;
}
