import { describe, expect, it } from "vitest";
import { BUILDS, POSES, buildFigure, hairCap, poseResident } from "../../../../src/components/residents/models/residentFigure";
import { CLOTH, HAIR, SKIN } from "../../../../src/components/residents/models/residentPalette";

const style = { build: "AVERAGE" as const, height: 1, skin: SKIN.TAN, brows: HAIR.BROWN, top: CLOTH.DENIM, bottom: CLOTH.SLATE };

describe("buildFigure", () => {
  it.each(BUILDS)("builds a %s figure with wider shoulders the broader it is", (build) => {
    const rig = buildFigure({ ...style, build });
    expect(rig.root.children).toHaveLength(3);
    expect(Math.abs(rig.leftArm.position.z)).toBeGreaterThan(0.2);
  });

  it("scales to its height and takes custom shoes", () => {
    const rig = buildFigure({ ...style, height: 1.1, shoes: CLOTH.CREAM });
    expect(rig.root.scale.y).toBeCloseTo(1.1);
    expect(hairCap(HAIR.GREY).children).toHaveLength(1);
  });
});

describe("poseResident", () => {
  it.each(POSES)("%s is pure rotation and leaves the legs straight", (pose) => {
    const rig = buildFigure(style);
    poseResident(rig, pose, 0.7);
    expect(rig.leftLeg.rotation.x).toBe(0);
    expect(rig.torso.position.y).toBeCloseTo(0.6);
  });

  it("raises the right arm to wave and lowers it again", () => {
    const rig = buildFigure(style);
    poseResident(rig, "WAVE", 0.2);
    expect(rig.rightArm.rotation.x).toBeGreaterThan(2);
    poseResident(rig, "IDLE", 0.2);
    expect(rig.rightArm.rotation.x).toBeCloseTo(0.12);
  });
});
