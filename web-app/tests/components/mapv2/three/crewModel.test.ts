import { describe, expect, it } from "vitest";
import { buildCrew, CREW_POSES, poseCrew } from "../../../../src/components/mapv2/three/crewModel";

describe("buildCrew", () => {
  it("builds a jointed worker with hidden tools, varied by skin tone", () => {
    const rig = buildCrew(0);
    expect(rig.root.children).toHaveLength(3);
    expect(Object.values(rig.tools).every((t) => !t.visible)).toBe(true);
    expect(buildCrew(-1).root).toBeDefined();
  });
});

describe("poseCrew", () => {
  it.each(CREW_POSES)("%s shows only its own tool", (pose) => {
    const rig = buildCrew(1);
    poseCrew(rig, pose, 0.3);
    const shown = Object.entries(rig.tools).filter(([, t]) => t.visible).map(([n]) => n);
    expect(shown).toEqual(["SHOVEL", "HAMMER", "SAW"].includes(pose) ? [pose] : []);
  });

  it("swings legs in opposition when walking and raises an arm to wave", () => {
    const rig = buildCrew(0);
    poseCrew(rig, "WALK", 0.25);
    expect(rig.leftLeg.rotation.z).toBeCloseTo(-rig.rightLeg.rotation.z);
    expect(rig.leftLeg.rotation.z).not.toBe(0);
    poseCrew(rig, "WAVE", 0);
    expect(rig.rightArm.rotation.x).toBeCloseTo(2.6);
    poseCrew(rig, "IDLE", 0);
    expect(rig.rightArm.rotation.x).toBe(0);
  });

  it("leans forward to dig, hammer and saw", () => {
    const rig = buildCrew(0);
    for (const pose of ["SHOVEL", "HAMMER", "SAW"] as const) {
      poseCrew(rig, pose, 0.1);
      expect(rig.torso.rotation.z).toBeLessThan(0);
    }
  });
});
