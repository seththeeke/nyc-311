import { DirectionalLight, HemisphereLight, Vector3 } from "three";
import { describe, expect, it } from "vitest";
import { buildResidentModel } from "../../../../src/components/residents/models/residentModels";
import { fullBodyCamera, portraitCamera, studioScene } from "../../../../src/components/residents/models/residentScene";

describe("resident scenes", () => {
  it("lights a studio with a fill and a key light", () => {
    const scene = studioScene();
    expect(scene.children.some((child) => child instanceof HemisphereLight)).toBe(true);
    expect(scene.children.some((child) => child instanceof DirectionalLight)).toBe(true);
  });

  it("frames the portrait on the head, from in front", () => {
    const rig = buildResidentModel("sycamore")!;
    const camera = portraitCamera(rig);
    const head = rig.head.getWorldPosition(new Vector3());
    expect(camera.position.x).toBeGreaterThan(head.x + 1);
    expect(Math.abs(camera.position.y - head.y)).toBeLessThan(0.2);
  });

  it("frames the full body at the given aspect", () => {
    const camera = fullBodyCamera(0.75);
    expect(camera.aspect).toBe(0.75);
    expect(camera.position.x).toBeGreaterThan(3);
  });
});
