import { Group } from "three";
import { FICTION, HERO } from "../../../residents/models/residentPalette";
import type { TeamRig } from "../kit/teamBody";
import { sparkBurst } from "../kit/teamEffects";
import { applyPose, type Beat, blend, carry, progress } from "../kit/teamMotion";
import { type CaseBoard, drawString } from "./sableProps";

/*
 * Sable's signature (#146): a clue card comes up to the magnifying glass
 * for a long, close look, and the lens glints. A turn to the case board,
 * the card pinned up, red string drawn to the case's centre card. Then
 * back to face you, a two-finger tip of the fedora's brim and a knowing
 * look.
 */

/* `pin` carries the card from the hand to the board; `string` draws the red string; `tip` tips the hat. */
type Custom = "pin" | "string" | "tip" | "card";

export const SABLE_CYCLE = 9.0;
export const SABLE_STILL = 1.9;
const GLINT = 1.75;
const PINNED = 3.35;

const LOOK = { "rightArm.z": 0.95, "rightArm.x": 0.35, "rightForearm.z": 1.3, "leftArm.z": 1.15, "leftArm.x": 0.1, "leftForearm.z": 0.75, "head.z": -0.22, "torso.z": -0.08, card: 1 };
const REACH = { "leftArm.z": 1.2, "leftArm.x": -1.0, "leftForearm.z": 0.3, "torso.y": -0.55, "head.y": -0.35, "head.z": 0.0, "rightArm.z": 0.2, card: 1 };
const TIP = { "leftArm.z": 2.35, "leftArm.x": -0.1, "leftForearm.z": 1.2, "head.z": -0.12, "head.y": 0.1, tip: 1 };

const BEATS: Beat<Custom>[] = [
  { at: 0, pose: {} },
  { at: 0.35, pose: { card: 1 } },
  { at: 0.95, pose: LOOK, ease: "BACK" },
  { at: 1.5, pose: { ...LOOK, "head.y": 0.08, "rightArm.y": 0.08 } },
  { at: 2.1, pose: { ...LOOK, "head.y": -0.08, "rightArm.y": -0.06 } },
  { at: 2.5, pose: LOOK },
  { at: 3.0, pose: REACH },
  { at: PINNED, pose: { ...REACH, pin: 1, "leftArm.z": 1.3 }, ease: "IN" },
  { at: 3.6, pose: { ...REACH, pin: 1, "leftForearm.z": 0.6 } },
  { at: 4.6, pose: { ...REACH, pin: 1, string: 1, "head.y": -0.2 } },
  { at: 5.2, pose: { pin: 1, string: 1 } },
  { at: 5.7, pose: { ...TIP, pin: 1, string: 1 }, ease: "BACK" },
  { at: 6.1, pose: { ...TIP, pin: 1, string: 1, tip: 0.2, "head.z": 0.05 } },
  { at: 6.6, pose: { pin: 1, string: 1, "head.y": 0.15, "head.z": 0.06 } },
  { at: 7.8, pose: { pin: 1, string: 1, "head.y": 0.05 } },
  { at: 8.4, pose: { pin: 1, string: 0 } },
  { at: SABLE_CYCLE, pose: { pin: 1 } },
];

export interface SableProps {
  hat: Group;
  lens: Group;
  card: Group;
  board: CaseBoard;
}

/** Gives Sable the clue, the case board and the hat tip. */
export function performSable(rig: TeamRig, props: SableProps): (t: number) => void {
  const glint = sparkBurst(FICTION.STAR, { count: 10, reach: 0.08, rise: 0.08, fall: 0.01, size: 0.007 });
  props.lens.add(glint.group);
  const pinned = sparkBurst(HERO.RED, { count: 8, reach: 0.06, rise: 0.06, fall: 0.02, size: 0.006 });
  props.board.slot.add(pinned.group);
  const hand = new Group();
  hand.position.set(0.035, -0.02, 0);
  hand.rotation.set(0, 0, -Math.PI / 2);
  rig.leftGrip.add(hand);
  const restTilt = props.hat.rotation.z;
  const restY = props.hat.position.y;
  return (time) => {
    const t = time % SABLE_CYCLE;
    const pose = blend(BEATS, t);
    applyPose(rig, pose);
    props.hat.rotation.z = restTilt + 0.35 * pose("tip");
    props.hat.position.y = restY + 0.03 * pose("tip");
    /* The card rides in the left hand, then flies to its slot on the board; it fades out at the loop's end and back into the hand. */
    carry(rig, props.card, hand, props.board.slot, pose("pin"), 0.04);
    const fade = Math.min(1, Math.max(0, progress(t, SABLE_CYCLE - 0.5, SABLE_CYCLE - 0.05)));
    props.card.scale.multiplyScalar(Math.max(0.001, t < 1 ? pose("card") : 1 - fade));
    drawString(props.board.string, pose("string"));
    glint.update(progress(t, GLINT, GLINT + 0.5));
    pinned.update(progress(t, PINNED, PINNED + 0.4));
  };
}
