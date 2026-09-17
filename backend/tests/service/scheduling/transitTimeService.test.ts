import { describe, expect, it } from "vitest";
import { straightLineTransitTimeEstimator } from "../../../service/scheduling/transitTimeService";

/* Pure-latitude deltas only, so the expected distance is exactly |deltaLat| * 69 miles — no longitude/cos(lat) math to reason about in these assertions. */
const MILES_PER_DEGREE_LATITUDE = 69;

function pointsApart(miles: number): { from: { lat: number; lng: number }; to: { lat: number; lng: number } } {
  return {
    from: { lat: 0, lng: 0 },
    to: { lat: miles / MILES_PER_DEGREE_LATITUDE, lng: 0 },
  };
}

describe("straightLineTransitTimeEstimator.estimateMinutes", () => {
  it("floors two identical points at the minimum transit time", async () => {
    const point = { lat: 40.7128, lng: -74.006 };

    await expect(straightLineTransitTimeEstimator.estimateMinutes(point, point)).resolves.toBe(10);
  });

  it("floors a very short trip at the minimum transit time rather than a near-zero duration", async () => {
    const { from, to } = pointsApart(1);

    await expect(straightLineTransitTimeEstimator.estimateMinutes(from, to)).resolves.toBe(10);
  });

  it("computes distance/speed directly for a mid-range trip with no long-haul penalty", async () => {
    const { from, to } = pointsApart(6.9);

    const minutes = await straightLineTransitTimeEstimator.estimateMinutes(from, to);

    expect(minutes).toBeCloseTo((6.9 / 25) * 60, 5);
  });

  it("applies one long-haul bracket (+10%) between 25 and 50 miles", async () => {
    const { from, to } = pointsApart(30);

    const minutes = await straightLineTransitTimeEstimator.estimateMinutes(from, to);

    expect(minutes).toBeCloseTo(((30 * 1.1) / 25) * 60, 5);
  });

  it("applies two long-haul brackets (+20%) between 50 and 75 miles", async () => {
    const { from, to } = pointsApart(60);

    const minutes = await straightLineTransitTimeEstimator.estimateMinutes(from, to);

    expect(minutes).toBeCloseTo(((60 * 1.2) / 25) * 60, 5);
  });

  it("is symmetric regardless of which point is `from` and which is `to`", async () => {
    const { from, to } = pointsApart(15);

    const there = await straightLineTransitTimeEstimator.estimateMinutes(from, to);
    const back = await straightLineTransitTimeEstimator.estimateMinutes(to, from);

    expect(there).toBeCloseTo(back, 10);
  });
});
