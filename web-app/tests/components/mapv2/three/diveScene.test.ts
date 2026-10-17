import { describe, expect, it, vi } from "vitest";
import { cameraAt, DiveScene } from "../../../../src/components/mapv2/three/diveScene";
import { SITE } from "../../../../src/components/mapv2/three/diveCast";

describe("cameraAt", () => {
  it("falls from straight above the site to a low resting view", () => {
    const start = cameraAt(0, true);
    const settled = cameraAt(10, false);
    expect(start.position[1]).toBe(64);
    expect(settled.position[1]).toBeCloseTo(12);
    expect(settled.target).toEqual([SITE.x, 1.1, SITE.z]);
  });

  it("sways across the front of the block only while orbiting", () => {
    expect(cameraAt(20, false).position).toEqual(cameraAt(40, false).position);
    expect(cameraAt(20, true).position[0]).not.toBeCloseTo(cameraAt(40, true).position[0]);
    for (const s of [5, 15, 25, 35, 45, 55]) expect(cameraAt(s, true).position[2]).toBeGreaterThan(SITE.z);
  });

  it("clamps negative time to the start of the fall", () => {
    expect(cameraAt(-1, false)).toEqual(cameraAt(0, false));
  });
});

describe("DiveScene", () => {
  it("builds the block and cast, aims the camera and returns the loop state", () => {
    const dive = new DiveScene("STREET_REPAIR", "DARK");
    dive.setAspect(2);
    expect(dive.camera.aspect).toBe(2);
    const state = dive.update(8, 10, true);
    expect(state.phase).toBe("CUT");
    expect(dive.camera.position.y).toBeCloseTo(12);
    expect(dive.scene.children.length).toBeGreaterThan(4);
  });

  it("plays the generic script and disposes its scene", () => {
    const dive = new DiveScene("GENERIC", "LIGHT");
    expect(dive.update(8, 0, false).phase).toBe("WORK");
    const traverse = vi.spyOn(dive.scene, "traverse");
    dive.dispose();
    expect(traverse).toHaveBeenCalled();
  });
});
