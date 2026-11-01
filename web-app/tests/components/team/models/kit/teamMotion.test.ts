import { Group, Mesh, Vector3 } from "three";
import { describe, expect, it } from "vitest";
import { DETAIL, FACE, SKIN } from "../../../../../src/components/residents/models/residentPalette";
import { buildTeamBody, type TeamRig, worldUpIn } from "../../../../../src/components/team/models/kit/teamBody";
import { dustPuff, shockwave, sparkBurst } from "../../../../../src/components/team/models/kit/teamEffects";
import { settleLegs } from "../../../../../src/components/team/models/kit/teamLegs";
import { satin } from "../../../../../src/components/team/models/kit/teamMaterials";
import { applyPose, type Beat, blend, carry, finishRig, poseTeam, progress } from "../../../../../src/components/team/models/kit/teamMotion";
import { ball, part } from "../../../../../src/components/team/models/kit/teamShapes";

function body(): TeamRig {
  return buildTeamBody({ height: 1, skin: SKIN.LIGHT, top: DETAIL.STEEL, bottom: DETAIL.STEEL, shoes: DETAIL.STEEL, face: { skin: SKIN.LIGHT, iris: FACE.IRIS_BLUE, brows: DETAIL.EYE } });
}

function feetY(rig: TeamRig): number {
  rig.root.updateMatrixWorld(true);
  return rig.leftFoot.getWorldPosition(new Vector3()).y;
}

describe("blend", () => {
  const beats: Beat<"glow">[] = [
    { at: 0, pose: {} },
    { at: 1, pose: { "head.z": 1, glow: 2 }, ease: "LINEAR" },
    { at: 2, pose: { "head.z": 0 }, ease: "BACK" },
    { at: 3, pose: { lift: 1 }, ease: "IN" },
    { at: 4, pose: { lift: 0 }, ease: "OUT" },
    { at: 5, pose: { crouch: 1 } },
    { at: 5, pose: { crouch: 0.5 } },
  ];

  it("eases between beats, missing channels count as rest, and holds the last beat", () => {
    expect(blend(beats, 0.5)("head.z")).toBeCloseTo(0.5);
    expect(blend(beats, 0.5)("glow")).toBeCloseTo(1);
    expect(blend(beats, 0.5)("lift")).toBe(0);
    expect(blend(beats, 1.5)("head.z")).toBeLessThan(0.5);
    expect(blend(beats, 2.5)("lift")).toBeCloseTo(0.125);
    expect(blend(beats, 3.5)("lift")).toBeCloseTo(0.125);
    expect(blend(beats, 4.5)("crouch")).toBeCloseTo(0.5);
    expect(blend(beats, 9)("crouch")).toBe(0.5);
    expect(blend([{ at: 0, pose: { lift: 2 } }], 3)("lift")).toBe(2);
  });

  it("measures progress through a window", () => {
    expect(progress(1.5, 1, 2)).toBe(0.5);
    expect(progress(0, 1, 2)).toBeLessThan(0);
  });
});

describe("poses on the rig", () => {
  it("crouches with the feet staying on the floor, lifts, and goes back to rest each frame", () => {
    const rig = finishRig(body());
    poseTeam(rig, 0);
    const floor = feetY(rig);
    applyPose(rig, blend([{ at: 0, pose: { crouch: 0.7, "head.y": 0.3 } }], 0));
    expect(rig.leftShin.rotation.z).toBeCloseTo(-1.4);
    expect(feetY(rig)).toBeCloseTo(floor, 2);
    expect(rig.head.rotation.y).toBeCloseTo(0.3);
    applyPose(rig, blend([{ at: 0, pose: { lift: 0.2 } }], 0));
    expect(feetY(rig)).toBeGreaterThan(floor);
    poseTeam(rig, 0);
    expect(feetY(rig)).toBeCloseTo(floor, 5);
    expect(rig.leftShin.rotation.z).toBe(0);
  });

  it("skips joints it never saw at rest", () => {
    const rig = body();
    rig.head.position.y = 9;
    poseTeam(rig, 0);
    expect(rig.head.position.y).toBe(9);
  });

  it("moves props hung on the hip onto the shin and foot they sit on, and leaves rubber-hose legs alone", () => {
    const rig = body();
    const boot = part(ball(0.03), satin(DETAIL.STEEL), [0.05, -0.55, 0]);
    const plate = part(ball(0.03), satin(DETAIL.STEEL), [0.05, -0.38, 0]);
    const cuff = part(ball(0.03), satin(DETAIL.STEEL), [0.05, -0.1, 0]);
    rig.leftLeg.add(boot, plate, cuff);
    settleLegs(rig);
    expect(boot.parent).toBe(rig.leftFoot);
    expect(plate.parent).toBe(rig.leftShin);
    expect(cuff.parent).toBe(rig.leftLeg);
    const hose = body();
    hose.leftShin = new Group();
    expect(finishRig(hose)).toBe(hose);
  });

  it("carries a prop from one anchor to another, arcing, and finds world up in a turned hand", () => {
    const rig = finishRig(body());
    const from = new Group();
    const to = new Group();
    to.position.set(0, 1, 0);
    to.scale.setScalar(2);
    rig.root.add(from, to);
    const prop = new Group();
    rig.root.add(prop);
    carry(rig, prop, from, to, 0.5, 0.2);
    expect(prop.position.y).toBeCloseTo(0.7);
    expect(prop.scale.x).toBeCloseTo(1.5);
    rig.leftArm.rotation.z = Math.PI;
    expect(worldUpIn(rig.leftHand).y).toBeLessThan(-0.9);
  });
});

describe("effects", () => {
  it("show only inside their window and spread as they play", () => {
    for (const effect of [sparkBurst(DETAIL.LENS), sparkBurst(DETAIL.LENS, { count: 4, reach: 1, rise: 1, fall: 0, size: 0.02, upward: 1 }), shockwave(DETAIL.LENS), dustPuff(DETAIL.LENS)]) {
      effect.update(-0.5);
      expect(effect.group.visible).toBe(false);
      effect.update(0.5);
      expect(effect.group.visible).toBe(true);
      expect(effect.group.userData.fx).toBe(true);
      effect.update(1);
      expect(effect.group.visible).toBe(false);
    }
    const ring = shockwave(DETAIL.LENS, 1);
    ring.update(0.5);
    expect(ring.group.scale.x).toBeGreaterThan(0.5);
    expect(ring.group.children[0]).toBeInstanceOf(Mesh);
  });
});
