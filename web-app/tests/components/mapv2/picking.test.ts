import { describe, expect, it } from "vitest";
import { pickNearest } from "../../../src/components/mapv2/picking";

const anchors = [
  { operatorId: "A", location: { lat: 0, lng: 0 } },
  { operatorId: "B", location: { lat: 0, lng: 10 } },
];
/* A stand-in projection: 1° of longitude = 1px. */
const project = ({ lng, lat }: { lng: number; lat: number }) => ({ x: lng, y: lat });

describe("pickNearest", () => {
  it("picks the closest truck within the radius", () => {
    expect(pickNearest(anchors, project, { x: 7, y: 0 })).toBe("B");
    expect(pickNearest(anchors, project, { x: 2, y: 0 })).toBe("A");
  });

  it("returns null when nothing is close enough", () => {
    expect(pickNearest(anchors, project, { x: 100, y: 100 })).toBeNull();
    expect(pickNearest(anchors, project, { x: 5, y: 0 }, 2)).toBeNull();
    expect(pickNearest([], project, { x: 0, y: 0 })).toBeNull();
  });
});
