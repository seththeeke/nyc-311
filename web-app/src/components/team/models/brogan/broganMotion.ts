import { Group, type MeshStandardMaterial, Vector3 } from "three";
import { CLOTH, FICTION } from "../../../residents/models/residentPalette";
import { type TeamRig, worldUpIn } from "../kit/teamBody";
import { dustPuff, shockwave, sparkBurst } from "../kit/teamEffects";
import { applyPose, type Beat, blend, progress } from "../kit/teamMotion";
import type { Hammer } from "./broganGear";

/*
 * Brogan's signature (#146): he flips the hammer up into his fist by the
 * haft, hoists it overhead with the runes kindling, and brings it down
 * on the stone in a burst of sparks and a ring of light. Then he flips it
 * back, plants it and gives a satisfied nod.
 */

type Custom = "flip" | "glow";

export const BROGAN_CYCLE = 8.6;
export const BROGAN_STILL = 3.1;
const STRIKE = 3.95;
/* At rest the haft stands just in front of his fist, not through his forearm. */
const HOLD_FORWARD = 0.06;

const RAISED = { "body.y": -0.95, "leftArm.z": 2.95, "leftArm.x": -0.12, "leftForearm.z": 0.12, "rightArm.x": 0.75, "rightForearm.z": 1.9, "rightArm.z": 0.35, "torso.z": 0.1, "head.z": 0.16, crouch: 0.14, "leftLeg.x": -0.1, "rightLeg.x": 0.1, flip: 1, glow: 1 };
const HIT = { "body.y": -0.9, "leftArm.z": 1.4, "leftForearm.z": 0.05, "rightArm.z": 1.25, "rightArm.x": -0.22, "rightForearm.z": 0.4, "torso.z": -0.5, "head.z": 0.05, crouch: 0.5, "leftLeg.x": -0.12, "rightLeg.x": 0.12, flip: 1, glow: 1 };

const BEATS: Beat<Custom>[] = [
  { at: 0, pose: {} },
  { at: 0.6, pose: {} },
  { at: 1.2, pose: { "body.y": -0.5, "leftArm.z": 0.15, "leftForearm.z": 0.15, "head.z": -0.12, crouch: 0.16, flip: -0.06 } },
  { at: 1.45, pose: { "body.y": -0.7, "leftArm.z": 0.95, "leftForearm.z": 0.3, "head.z": 0.15, flip: 0.4 }, ease: "OUT" },
  { at: 2.05, pose: { "body.y": -0.85, "leftArm.z": 1.35, "leftForearm.z": 0.25, "head.z": 0.1, flip: 1 } },
  { at: 2.7, pose: RAISED, ease: "BACK" },
  { at: 3.45, pose: { ...RAISED, "head.z": 0.12, "torso.z": 0.08 } },
  { at: 3.75, pose: { ...RAISED, "leftArm.z": 3.55, "rightArm.z": 3.1, "rightArm.x": -0.25, "rightForearm.z": 0.3, "torso.z": 0.3, "head.z": 0.4, crouch: 0.05 } },
  { at: STRIKE, pose: HIT, ease: "IN" },
  { at: 4.55, pose: { ...HIT, "torso.z": -0.44, crouch: 0.42, "head.z": 0.12, glow: 0.3 } },
  { at: 5.2, pose: { "body.y": -0.8, "leftArm.z": 1.35, "leftForearm.z": 0.25, flip: 1 } },
  { at: 5.6, pose: { "body.y": -0.6, "leftArm.z": 0.95, "leftForearm.z": 0.3, "head.z": 0.15, flip: 0.6 }, ease: "OUT" },
  { at: 6.2, pose: { "body.y": -0.3, "leftArm.z": 0.15, "leftForearm.z": 0.15, "head.z": -0.1, crouch: 0.12 } },
  { at: 6.9, pose: { "head.z": -0.2 } },
  { at: 7.4, pose: { "head.z": 0.06, "torso.z": 0.03 } },
  { at: BROGAN_CYCLE, pose: {} },
];

/* 0 outside a window, rising to 1 mid-window and back: a toss's height. */
function arc(k: number): number {
  return k > 0 && k < 1 ? Math.sin(Math.PI * k) : 0;
}

/** Gives Brogan his hammer strike; `drop` is the hammer's grip-to-floor length. */
export function performBrogan(rig: TeamRig, hammer: Hammer, drop: number, flame: MeshStandardMaterial): (t: number) => void {
  /* The hammer turns in a holder on the fist: neck-grip at rest, flipped to a haft-end grip to swing. */
  const holder = new Group();
  rig.leftGrip.add(holder);
  holder.add(hammer.group);
  const fx = new Group();
  fx.userData.fx = true;
  const sparks = sparkBurst(FICTION.EMBER, { count: 26, reach: 0.5, rise: 0.45, fall: 0.35, upward: 0.4, size: 0.014 });
  const ring = shockwave(FICTION.VISOR, 0.85);
  const dust = dustPuff(CLOTH.SAND, 0.4);
  fx.add(sparks.group, ring.group, dust.group);
  rig.root.add(fx);
  return (time) => {
    const t = time % BROGAN_CYCLE;
    const pose = blend(BEATS, t);
    applyPose(rig, pose);
    const flip = pose("flip");
    holder.rotation.z = Math.PI * flip;
    holder.position.set(HOLD_FORWARD * (1 - flip), flip * (0.04 - drop), 0);
    holder.position.addScaledVector(worldUpIn(rig.leftGrip), (arc(progress(t, 1.45, 2.05)) + arc(progress(t, 5.6, 6.2))) * 0.22);
    hammer.runes.emissiveIntensity = pose("glow") * (2.2 + Math.sin(t * 9) * 0.4);
    const k = progress(t, STRIKE, STRIKE + 0.75);
    if (k >= 0 && k <= 0.8) {
      rig.root.updateMatrixWorld(true);
      const point = rig.root.worldToLocal(hammer.head.getWorldPosition(new Vector3()));
      fx.position.set(point.x, 0.01, point.z);
    }
    sparks.update(k);
    ring.update(progress(t, STRIKE, STRIKE + 0.6));
    dust.update(progress(t, STRIKE, STRIKE + 0.9));
    flame.emissiveIntensity = 2.1 + Math.sin(t * 13) * 0.35 + Math.sin(t * 31) * 0.2 + arc(k * 0.5 + 0.5) * 3;
  };
}
