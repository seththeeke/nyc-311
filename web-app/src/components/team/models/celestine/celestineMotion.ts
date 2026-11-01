import { FICTION } from "../../../residents/models/residentPalette";
import type { TeamRig } from "../kit/teamBody";
import { sparkBurst } from "../kit/teamEffects";
import { applyPose, type Beat, blend, progress } from "../kit/teamMotion";
import type { CrystalBall } from "./crystalBall";

/*
 * Celestine's signature (#146): she looks into the orb and draws slow
 * circles over it with her free hand; it lifts off her palm, brightening,
 * then rises above her head in a burst of stars as she opens her arms to
 * the vision. It settles back into her palm.
 */

type Custom = "float" | "power" | "circle";

export const CELESTINE_CYCLE = 9.6;
export const CELESTINE_STILL = 5.0;
const VISION = 4.6;

const GAZE = { "head.z": -0.24, "head.y": -0.32, "torso.y": -0.1 };
/* Hand angles solved to hover over the orb, and to open in a V under the risen orb. */
const HOVER = { ...GAZE, "rightArm.x": 1.28, "rightArm.z": 1.6, "rightForearm.z": 0.92, "rightHand.y": 1.2 };
const OPEN = { "rightArm.x": -0.52, "rightArm.y": 0.4, "rightArm.z": 2.7, "rightForearm.z": -0.08, "leftArm.x": -1.88, "leftArm.y": -1.0, "leftArm.z": 0.5, "leftForearm.z": -0.95, "head.z": 0.32, "torso.z": 0.1 };

const BEATS: Beat<Custom>[] = [
  { at: 0, pose: {} },
  { at: 0.9, pose: { ...GAZE, power: 0.1 } },
  { at: 1.9, pose: { ...HOVER, power: 0.35, float: 0.03 } },
  { at: 4.0, pose: { ...HOVER, power: 0.75, float: 0.14, circle: 1 } },
  { at: VISION, pose: { ...OPEN, power: 1, float: 0.72 }, ease: "BACK" },
  { at: 6.4, pose: { ...OPEN, "head.z": 0.26, power: 0.9, float: 0.76 } },
  { at: 7.6, pose: { ...GAZE, power: 0.3, float: 0.02 } },
  { at: 8.6, pose: { power: 0.05 } },
  { at: CELESTINE_CYCLE, pose: {} },
];

/** Gives Celestine her vision; `orb` must already sit on her palm. */
export function performCelestine(rig: TeamRig, orb: CrystalBall): (t: number) => void {
  /* The orb leaves her hand during the vision, so it floats from where it rests, on the figure itself. */
  rig.root.updateMatrixWorld(true);
  rig.root.attach(orb.group);
  const rest = orb.group.position.clone();
  const stars = sparkBurst(FICTION.STAR, { count: 30, reach: 0.45, rise: 0.4, fall: 0.15, upward: 0.2, size: 0.01 });
  rig.root.add(stars.group);
  return (time) => {
    const t = time % CELESTINE_CYCLE;
    const pose = blend(BEATS, t);
    applyPose(rig, pose);
    /* Slow mystic circles over the orb. */
    const circle = pose("circle") * Math.min(1, Math.max(0, progress(t, 1.9, 2.4)));
    rig.rightArm.rotation.x += Math.sin(time * 3) * 0.12 * circle;
    rig.rightArm.rotation.z += Math.cos(time * 3) * 0.12 * circle;
    const float = pose("float");
    orb.group.position.copy(rest);
    orb.group.position.y += float + Math.sin(time * 2.2) * 0.012 * Math.min(1, float * 10);
    orb.group.scale.setScalar(1 + float * 0.7);
    orb.update(time, pose("power"));
    stars.group.position.copy(orb.group.position);
    stars.update(progress(t, VISION - 0.1, VISION + 1.2));
  };
}
