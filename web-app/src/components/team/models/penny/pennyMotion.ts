import { Group } from "three";
import { FICTION } from "../../../residents/models/residentPalette";
import type { TeamRig } from "../kit/teamBody";
import { shockwave, sparkBurst } from "../kit/teamEffects";
import { applyPose, type Beat, blend, progress } from "../kit/teamMotion";
import type { TypewriterParts } from "./pennyMachine";
import type { Projector } from "./pennyProjector";

/*
 * Penny's signature (#146): she types up a storm while the carriage
 * creeps along, hits the end of the line (ding!), bounces, slaps the
 * carriage back with the return lever and wags a gloved finger at you
 * before getting back to the minutes.
 */

type Custom = "carriage" | "typing" | "wag" | "stretch";

export const PENNY_CYCLE = 7.6;
export const PENNY_STILL = 4.6;
const DING = 3.0;

const TYPE = { "leftArm.z": 1.2, "leftArm.x": 0.8, "leftForearm.z": 0.5, "rightArm.z": 1.2, "rightArm.x": -0.8, "rightForearm.z": 0.5, "head.z": -0.06, typing: 1 };
const WAG = { "rightArm.z": 0.35, "rightArm.x": 2.4, "rightForearm.z": 0.7, "leftArm.z": 0.3, "leftArm.x": -0.55, "leftForearm.z": 0.9, "head.x": 0.16, "head.z": 0.05, "torso.x": -0.06, "body.y": -0.3, carriage: 0, wag: 1, stretch: 0.8 };

const BEATS: Beat<Custom>[] = [
  { at: 0, pose: { ...TYPE, carriage: 0 } },
  { at: DING, pose: { ...TYPE, carriage: 1 }, ease: "LINEAR" },
  { at: DING + 0.15, pose: { ...TYPE, typing: 0, carriage: 1, lift: 0.07, "head.z": 0.18, "leftArm.z": 2.3, "leftArm.x": -0.25, "leftForearm.z": 0.6 }, ease: "OUT" },
  { at: DING + 0.4, pose: { ...TYPE, typing: 0, carriage: 1, "head.z": 0.1, "leftArm.z": 2.0, "leftArm.x": -0.35, "leftForearm.z": 0.9 } },
  { at: DING + 0.7, pose: { ...TYPE, typing: 0, carriage: 0, "head.z": 0.0, "leftArm.z": 1.6, "leftArm.x": 0.75, "leftForearm.z": 0.8, "body.y": 0.12 }, ease: "OUT" },
  { at: DING + 1.2, pose: WAG, ease: "BACK" },
  { at: DING + 2.6, pose: { ...WAG, "head.x": -0.1 } },
  { at: DING + 3.2, pose: { ...WAG, wag: 0, "rightArm.x": 0.6, "rightArm.z": 1.1, "rightForearm.z": 0.9, "leftArm.x": 0.4, "leftArm.z": 1.4, "leftForearm.z": 1.5, "head.x": 0, "body.y": -0.1 } },
  { at: PENNY_CYCLE, pose: { ...TYPE, carriage: 0 } },
];

/** Gives Penny her end-of-line routine; the projector's scanlines run throughout. */
export function performPenny(rig: TeamRig, machine: TypewriterParts, projector: Projector): (t: number) => void {
  const bell = new Group();
  bell.userData.fx = true;
  bell.position.set(-0.15, 0.5, 0.36);
  const sparks = sparkBurst(FICTION.STAR, { count: 14, reach: 0.18, rise: 0.25, fall: 0.05, upward: 0.7, size: 0.01 });
  const ring = shockwave(FICTION.HOLO, 0.22);
  ring.group.rotation.z = Math.PI / 2;
  bell.add(sparks.group, ring.group);
  rig.torso.add(bell);
  const restY = machine.keys.map((cap) => cap.position.y);
  const headZ = rig.head.position.z;
  return (time) => {
    const t = time % PENNY_CYCLE;
    const pose = blend(BEATS, t);
    applyPose(rig, pose);
    projector.update(time);
    const typing = pose("typing");
    machine.keys.forEach((cap, i) => {
      cap.position.y = restY[i] - (typing > 0.5 && Math.sin(time * 13 - i * 2.4) > 0.9 ? 0.012 : 0);
    });
    for (const [forearm, phase] of [[rig.leftForearm, 0], [rig.rightForearm, Math.PI]] as const) forearm.rotation.z += typing * Math.max(0, Math.sin(time * 13 + phase)) * 0.22;
    /* Rubber hose stretches: the wagging arm grows, the glove keeps its shape. */
    const stretch = 1 + pose("stretch");
    rig.rightArm.scale.y = stretch;
    rig.rightHand.scale.y = 1 / stretch;
    rig.rightForearm.rotation.x += pose("wag") * Math.sin(time * 14) * 0.4;
    rig.rightHand.rotation.x += pose("wag") * Math.sin(time * 14 - 0.8) * 0.35;
    const shift = -0.06 + pose("carriage") * 0.12;
    machine.carriage.position.z = shift;
    rig.head.position.z = headZ + shift;
    sparks.update(progress(t, DING, DING + 0.6));
    ring.update(progress(t, DING, DING + 0.45));
  };
}
