import { Group, type MeshStandardMaterial } from "three";
import { CLOTH, FICTION } from "../../../residents/models/residentPalette";
import { placeUpright, type TeamRig } from "../kit/teamBody";
import { dustPuff, shockwave } from "../kit/teamEffects";
import { applyPose, type Beat, blend, carry, progress } from "../kit/teamMotion";
import type { Helmet } from "./rexHelmet";

/*
 * Rex's signature (#146): he lifts the helmet from under his arm and
 * seats it, the visor powers up with a flash and the reactor surges, then
 * he drops into a power stance with a fist in the air. He holds it, takes
 * the helmet off again and tucks it back under his arm.
 */

/* `helmet` runs 0 (tucked) to 1 (held up) to 2 (on his head). */
type Custom = "helmet" | "power";

export const REX_CYCLE = 9.4;
export const REX_STILL = 4.4;
const STOMP = 3.45;
/* The helmet's size under the arm and on the head, where it has to clear his buzz cut. */
const TUCKED = 1.3;
const WORN = 1.45;

/* Arm angles solved for the hands to meet the helmet: held up in front of his face, then at the sides of his head. */
const LIFT = { "leftArm.x": 0.22, "leftArm.z": 1.1, "leftForearm.z": 0.45, "rightArm.x": -0.22, "rightArm.z": 1.1, "rightForearm.z": 1.52, "head.z": 0.1, helmet: 1 };
const ON = { "leftArm.x": 0.52, "leftArm.y": -0.8, "leftArm.z": 1.8, "leftForearm.z": 0.85, "rightArm.x": -0.52, "rightArm.y": 0.8, "rightArm.z": 1.8, "rightForearm.z": 1.92, helmet: 2 };
const STANCE = { "rightArm.x": -0.62, "rightArm.y": 0.8, "rightArm.z": 2.5, "rightForearm.z": 0.72, "leftArm.x": -0.38, "leftArm.y": 0.2, "leftArm.z": 0.7, "leftForearm.z": 0.35, "torso.y": -0.28, "torso.z": 0.05, "head.y": 0.2, "head.z": 0.08, "leftLeg.x": -0.2, "rightLeg.x": 0.2, crouch: 0.18, helmet: 2, power: 1 };

const BEATS: Beat<Custom>[] = [
  { at: 0, pose: {} },
  { at: 0.8, pose: { "head.y": 0.15 } },
  { at: 1.6, pose: LIFT },
  { at: 2.3, pose: ON },
  { at: 2.5, pose: { ...ON, "head.z": -0.12 } },
  { at: 2.8, pose: { ...ON, "head.z": 0.04, power: 1, "leftArm.z": 1.5, "rightArm.z": 1.5 } },
  { at: STOMP, pose: STANCE, ease: "BACK" },
  { at: 6.3, pose: { ...STANCE, "head.y": 0.1, "rightArm.z": 2.4 } },
  { at: 7.0, pose: { ...ON, power: 1 } },
  { at: 7.9, pose: { ...LIFT, power: 0 } },
  { at: 8.7, pose: {} },
  { at: REX_CYCLE, pose: {} },
];

export interface RexGlow {
  reactor: MeshStandardMaterial;
  tip: MeshStandardMaterial;
}

/** Gives Rex his helmet-on power stance. */
export function performRex(rig: TeamRig, helmet: Helmet, glow: RexGlow): (t: number) => void {
  const tucked = new Group();
  placeUpright(rig, rig.leftForearm, tucked, [0, -0.24, 0.02], [0.06, 0.04, 0.09]);
  tucked.scale.setScalar(TUCKED);
  /* Held up in front of his face, between his hands, on the way to his head. */
  const held = new Group();
  held.position.set(0.3, -0.06, 0);
  held.scale.setScalar(WORN);
  rig.head.add(held);
  const worn = new Group();
  worn.position.set(-0.012, 0.0, 0);
  worn.scale.setScalar(WORN);
  rig.head.add(worn);
  /* His face, hair and earpiece; the bare head sphere (first child) stays, to fill the helmet. */
  const features = rig.head.children.filter((child, i) => i > 0 && child !== held && child !== worn);
  rig.root.add(helmet.group);
  const fx = new Group();
  const ring = shockwave(FICTION.VISOR, 0.7);
  const dust = dustPuff(CLOTH.SAND, 0.45);
  fx.add(ring.group, dust.group);
  rig.root.add(fx);
  return (time) => {
    const t = time % REX_CYCLE;
    const pose = blend(BEATS, t);
    applyPose(rig, pose);
    const along = pose("helmet");
    if (along < 1) carry(rig, helmet.group, tucked, held, along, 0.05);
    else carry(rig, helmet.group, held, worn, along - 1, 0.1);
    /* Once the helmet is seated it covers his whole head, so nothing of the face pokes through the shell. */
    for (const feature of features) feature.visible = along < 1.9;
    const power = pose("power");
    const flash = Math.max(0, 1 - Math.abs(progress(t, 2.55, 2.95) - 0.5) * 2);
    helmet.visor.emissiveIntensity = 0.35 + power * (1.8 + Math.sin(time * 1.3) * 0.5) + flash * 5;
    glow.reactor.emissiveIntensity = 1.8 + (0.5 + 0.5 * Math.sin(time * 2.4)) * 1.6 + power * 1.8 + flash * 3;
    glow.tip.emissiveIntensity = Math.sin(time * (4 + power * 6)) > 0.6 ? 3 : 0.3;
    ring.update(progress(t, STOMP - 0.15, STOMP + 0.5));
    dust.update(progress(t, STOMP - 0.15, STOMP + 0.8));
  };
}
