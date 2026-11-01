import { Group } from "three";
import { CLOTH, FICTION } from "../../../residents/models/residentPalette";
import type { TeamRig } from "../kit/teamBody";
import { dustPuff, shockwave } from "../kit/teamEffects";
import { applyPose, type Beat, blend, progress } from "../kit/teamMotion";
import type { Cape } from "./kestrelSuit";

/*
 * Kid Kestrel's signature (#146): she crouches, springs into a tucked
 * backflip with the cape streaming, and comes down in a superhero
 * landing, one fist to the floor and a ring of dust. Then she rises into
 * a hero pose, fist up and the merged PR held out for you to see.
 */

/* `spin` is the flip, a full turn; `wind` streams the cape out behind her. */
type Custom = "spin" | "wind";

export const KESTREL_CYCLE = 8.6;
export const KESTREL_STILL = 2.4;
const LAND = 1.9;
const TURN = Math.PI * 2;

/* Arms solved for a fist held high and the tablet held out; the rest set by eye. */
const HERO = { "rightArm.x": -0.62, "rightArm.y": 0.8, "rightArm.z": 2.8, "rightForearm.z": 0.22, "leftArm.x": -0.28, "leftArm.z": 0.6, "leftForearm.z": 0.7, "torso.z": 0.08, "head.z": 0.1, "head.y": 0.1, "leftLeg.x": -0.1, "rightLeg.x": 0.1, spin: TURN, wind: 0.6 };
const LANDED = { spin: TURN, crouch: 0.9, "torso.z": -0.68, "head.z": 0.62, "rightArm.z": 0.8, "rightArm.x": 0.1, "rightForearm.z": 0.1, "leftArm.x": -1.3, "leftArm.z": -0.5, "leftForearm.z": -0.5, "rightLeg.z": 0.35, "leftLeg.z": -0.3, wind: 0.5 };

const BEATS: Beat<Custom>[] = [
  { at: 0, pose: {} },
  { at: 0.4, pose: {} },
  { at: 0.75, pose: { crouch: 0.6, "torso.z": -0.3, "leftArm.z": -0.9, "rightArm.z": -0.9, "head.z": 0.2 } },
  { at: 0.95, pose: { lift: 0.25, spin: 0.5, "leftArm.z": 2.8, "rightArm.z": 2.8, "head.z": 0.2, wind: 0.6 }, ease: "OUT" },
  { at: 1.3, pose: { lift: 0.55, spin: Math.PI, crouch: 0.95, "leftArm.x": -2.18, "leftArm.y": 0.6, "leftArm.z": 1.6, "leftForearm.z": -0.9, "rightArm.x": 2.18, "rightArm.y": -0.6, "rightArm.z": 1.6, "rightForearm.z": 0.72, "head.z": -0.35, wind: 1 } },
  { at: 1.65, pose: { lift: 0.32, spin: TURN - 0.6, crouch: 0.35, "leftArm.x": -1.2, "rightArm.x": 1.2, wind: 1 } },
  { at: LAND, pose: LANDED, ease: "IN" },
  { at: 3.0, pose: { ...LANDED, "head.z": 0.5, crouch: 0.8 } },
  { at: 3.6, pose: HERO, ease: "BACK" },
  { at: 6.0, pose: { ...HERO, "head.y": 0.2, "rightArm.z": 2.7 } },
  { at: 7.0, pose: { spin: TURN } },
  { at: KESTREL_CYCLE, pose: { spin: TURN } },
];

/** Gives Kid Kestrel her backflip landing; the cape flutters all the while. */
export function performKestrel(rig: TeamRig, flap: Cape): (t: number) => void {
  const fx = new Group();
  const ring = shockwave(FICTION.EMBER, 0.75);
  const dust = dustPuff(CLOTH.SAND, 0.5);
  fx.add(ring.group, dust.group);
  rig.root.add(fx);
  return (time) => {
    const t = time % KESTREL_CYCLE;
    const pose = blend(BEATS, t);
    applyPose(rig, pose);
    rig.body.rotation.z += pose("spin");
    const wind = pose("wind");
    flap.group.rotation.z = -0.06 - (0.5 + 0.5 * Math.sin(time * (2.6 + wind * 6))) * (0.12 + wind * 0.2) - wind * 0.9;
    flap.group.rotation.x = Math.sin(time * 1.9) * 0.04;
    ring.update(progress(t, LAND - 0.03, LAND + 0.6));
    dust.update(progress(t, LAND - 0.03, LAND + 1.0));
  };
}
