import { CylinderGeometry, Group, Vector3 } from "three";
import { FICTION } from "../../../residents/models/residentPalette";
import type { TeamRig } from "../kit/teamBody";
import { sparkBurst } from "../kit/teamEffects";
import { metal } from "../kit/teamMaterials";
import { applyPose, type Beat, blend, progress } from "../kit/teamMotion";
import { part, ring } from "../kit/teamShapes";

/*
 * Fergus's signature (#146): a gold coin appears in his fingers; he flips
 * it high, catches it, gives it a wink and it vanishes in a twinkle. Then
 * he crouches, springs up and clicks his heels at the top of the jump,
 * lands in a shower of gold and throws his arms wide.
 */

type Custom = "coin";

export const FERGUS_CYCLE = 8.8;
export const FERGUS_STILL = 3.62;
const TOSS = [1.0, 2.0] as const;
const LAND = 4.05;

/* Hand angles solved for holding the coin at his chest, showing it by his face, and arms flung wide. */
const COIN = { "rightArm.x": 1.88, "rightArm.y": -0.2, "rightArm.z": 1.2, "rightForearm.z": 1.12, "head.z": -0.12, "head.y": 0.12, coin: 1 };
const SHOW = { "rightArm.x": 0.38, "rightArm.y": 0.2, "rightArm.z": 1.0, "rightForearm.z": 1.32, "head.y": 0.2, "head.x": 0.12, coin: 1 };
const TADA = { "rightArm.x": 1.78, "rightArm.y": 0.6, "rightArm.z": -0.3, "rightForearm.z": 1.02, "leftArm.x": -1.78, "leftArm.y": -0.6, "leftArm.z": -0.3, "leftForearm.z": 0.7, "head.z": 0.12, "torso.z": 0.08 };
const CLICK = { lift: 0.36, "leftLeg.x": 0.4, "rightLeg.x": 0.62, "leftShin.z": -0.8, "rightShin.z": -0.8, "leftFoot.z": 0.3, "rightFoot.z": 0.3, "body.x": 0.22, "leftArm.x": -1.2, "rightArm.x": 1.4, "rightArm.z": 0.5, "head.z": 0.18, "torso.x": 0.08 };

const BEATS: Beat<Custom>[] = [
  { at: 0, pose: {} },
  { at: 0.6, pose: COIN, ease: "BACK" },
  { at: TOSS[0], pose: { ...COIN, "rightHand.z": 0.5, "head.z": 0.1 }, ease: "OUT" },
  { at: 1.5, pose: { ...COIN, "head.z": 0.5 } },
  { at: TOSS[1], pose: { ...COIN, "head.z": -0.05, crouch: 0.08 }, ease: "IN" },
  { at: 2.5, pose: SHOW, ease: "BACK" },
  { at: 2.95, pose: { ...SHOW, coin: 0 } },
  { at: 3.3, pose: { crouch: 0.5, "torso.z": -0.25, "leftArm.z": -0.5, "rightArm.z": -0.6, "head.z": 0.2 } },
  { at: 3.48, pose: { lift: 0.24, "leftArm.x": -0.8, "rightArm.x": 1.0, "head.z": 0.15 }, ease: "OUT" },
  { at: 3.62, pose: CLICK, ease: "OUT" },
  { at: 3.85, pose: { lift: 0.2, "leftArm.x": -0.9, "rightArm.x": 1.0, "body.x": 0.05 }, ease: "IN" },
  { at: LAND, pose: { crouch: 0.42, "torso.z": -0.15, "leftArm.x": -0.5, "rightArm.x": 0.6 }, ease: "IN" },
  { at: 4.6, pose: TADA, ease: "BACK" },
  { at: 6.0, pose: { ...TADA, "head.y": -0.15 } },
  { at: 6.9, pose: {} },
  { at: FERGUS_CYCLE, pose: {} },
];

function coin(): Group {
  const group = new Group();
  const gold = metal(FICTION.GOLD, 0.18);
  group.add(part(new CylinderGeometry(0.045, 0.045, 0.009, 32), gold));
  group.add(part(ring(0.039, 0.004, Math.PI * 2, 6, 32), metal(FICTION.STAR, 0.2), [0, 0.005, 0]));
  return group;
}

/** Gives Fergus his coin flip and heel click; `pot` glints harder when he lands. */
export function performFergus(rig: TeamRig, pot: { update: (t: number) => void }): (t: number) => void {
  const piece = coin();
  rig.root.add(piece);
  const twinkle = sparkBurst(FICTION.STAR, { count: 12, reach: 0.12, rise: 0.14, fall: 0.02, size: 0.008 });
  const shower = sparkBurst(FICTION.GOLD, { count: 28, reach: 0.4, rise: 0.35, fall: 0.3, upward: 0.55, size: 0.012 });
  rig.root.add(twinkle.group, shower.group);
  return (time) => {
    const t = time % FERGUS_CYCLE;
    const pose = blend(BEATS, t);
    applyPose(rig, pose);
    pot.update(time);
    /* The coin rides in his fingers, or flies straight up from them, tumbling. */
    rig.root.updateMatrixWorld(true);
    const hand = rig.root.worldToLocal(rig.rightGrip.getWorldPosition(new Vector3()));
    const k = progress(t, TOSS[0], TOSS[1]);
    const flying = k > 0 && k < 1;
    piece.position.copy(hand);
    piece.position.y += flying ? Math.sin(Math.PI * k) * 0.62 : 0;
    piece.rotation.set(0, 0.4, Math.PI / 2 + (flying ? k * Math.PI * 8 : 0));
    piece.scale.setScalar(Math.max(0.001, pose("coin")));
    twinkle.group.position.copy(hand);
    twinkle.update(progress(t, 2.8, 3.4));
    shower.update(progress(t, LAND - 0.05, LAND + 0.9));
  };
}
