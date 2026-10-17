import { describe, expect, it } from "vitest";
import { createMotion, easeInOutCubic, glideDurationMs, retargetMotion, sampleMotion } from "../../../src/components/mapv2/truckMotion";

const A = { lat: 40.7, lng: -74 };
const B = { lat: 40.7, lng: -73.99 };

describe("easeInOutCubic", () => {
  it("starts at 0, passes 0.5 halfway and ends at 1", () => {
    expect(easeInOutCubic(0)).toBe(0);
    expect(easeInOutCubic(0.5)).toBe(0.5);
    expect(easeInOutCubic(1)).toBe(1);
    expect(easeInOutCubic(0.25)).toBeLessThan(0.25);
    expect(easeInOutCubic(0.75)).toBeGreaterThan(0.75);
  });
});

describe("glideDurationMs", () => {
  it("clamps short hops up and long jumps down", () => {
    expect(glideDurationMs(A, { lat: 40.70001, lng: -74 })).toBe(1500);
    expect(glideDurationMs(A, { lat: 41, lng: -74 })).toBe(9000);
  });

  it("scales with distance in between", () => {
    const ms = glideDurationMs(A, { lat: 40.7, lng: -73.999 });
    expect(ms).toBeGreaterThan(1500);
    expect(ms).toBeLessThan(9000);
  });
});

describe("createMotion", () => {
  it("parks the truck, facing along its last job to here", () => {
    const motion = createMotion(B, A, 0);
    expect(motion.heading).toBeCloseTo(0);
    expect(sampleMotion(motion, 0)).toEqual({ location: B, heading: motion.heading, progress: 1, isMoving: false });
  });

  it("faces east (0) without a previous job, or when the previous job is right here", () => {
    expect(createMotion(B, null, 0).heading).toBe(0);
    expect(createMotion(B, B, 0).heading).toBe(0);
  });
});

describe("retargetMotion", () => {
  it("keeps the same motion when the poll didn't move the truck", () => {
    const motion = createMotion(A, null, 0);
    expect(retargetMotion(motion, { ...A }, 100)).toBe(motion);
  });

  it("glides from where it's drawn to the new target with easing", () => {
    const motion = retargetMotion(createMotion(A, null, 0), B, 1000);
    const start = sampleMotion(motion, 1000);
    const mid = sampleMotion(motion, 1000 + motion.durationMs / 2);
    const end = sampleMotion(motion, 1000 + motion.durationMs + 50);
    expect(start.isMoving).toBe(true);
    expect(start.location.lng).toBeCloseTo(A.lng);
    expect(mid.location.lng).toBeCloseTo((A.lng + B.lng) / 2);
    expect(end).toMatchObject({ location: B, progress: 1, isMoving: false });
  });

  it("re-aims mid-glide without teleporting, and keeps its heading for a zero-length hop", () => {
    const gliding = retargetMotion(createMotion(A, null, 0), B, 0);
    const midway = sampleMotion(gliding, gliding.durationMs / 2).location;
    const north = { lat: 40.72, lng: midway.lng };
    const turned = retargetMotion(gliding, north, gliding.durationMs / 2);
    expect(turned.from.lng).toBeCloseTo(midway.lng);
    expect(turned.heading).toBeCloseTo(Math.PI / 2);
    const parked = { ...turned, durationMs: 0 };
    const sameSpot = retargetMotion(parked, { lat: north.lat + 1e-9, lng: north.lng }, 0);
    expect(sameSpot.heading).toBe(turned.heading);
  });

  it("clamps progress before the glide starts", () => {
    const motion = retargetMotion(createMotion(A, null, 0), B, 1000);
    expect(sampleMotion(motion, 0).progress).toBe(0);
  });
});
