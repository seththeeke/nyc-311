import { Group, Vector3 } from "three";
import { CLOTH, FICTION } from "../../../residents/models/residentPalette";
import type { TeamRig } from "../kit/teamBody";
import { dustPuff, shockwave, sparkBurst } from "../kit/teamEffects";
import { applyPose, type Beat, blend, progress } from "../kit/teamMotion";
import { COIN_BASE, COIN_STEP, SCROLL_LENGTH, TOLL_COINS, type TollScroll, type TollSign } from "./grimbleProps";

/*
 * Grimble's signature (#146): the toll scroll comes off the belt and
 * unrolls to the floor; a squint through the spectacles, a push of them up
 * the nose, then the bottom half gets torn clean off and tossed. One stomp
 * shakes the bridge, the extra coins pop off the toll sign, and Grimble
 * pats that belly with a satisfied nod.
 */

/* `unroll` is how far the scroll hangs open; it rolls back up into the fist and away. */
type Custom = "unroll";

export const GRIMBLE_CYCLE = 9.4;
export const GRIMBLE_STILL = 3.5;
const TEAR = 3.45;
const STOMP = 4.85;
const KEPT_COINS = 3;

const HOLD = { "leftArm.z": 1.25, "leftArm.x": 0.15, "leftForearm.z": 0.55, "head.z": -0.22, "torso.z": -0.06 };
const READ = { ...HOLD, "head.z": -0.3, "torso.z": -0.12, unroll: 1 };
const SPECS = { ...READ, "rightArm.z": 1.4, "rightArm.x": -0.35, "rightForearm.z": 2.0, "head.z": -0.18 };
const GRAB = { ...READ, "rightArm.z": 0.95, "rightArm.x": -0.3, "rightForearm.z": 0.35, "torso.y": -0.15 };
const RIP = { ...READ, "rightArm.z": 0.3, "rightArm.x": 1.1, "rightForearm.z": 0.4, "torso.y": 0.2, "head.y": -0.25 };
const PAT = { "leftArm.z": 0.35, "leftArm.x": 0.3, "leftForearm.z": 1.05, "rightArm.z": 0.35, "rightArm.x": -0.3, "rightForearm.z": 1.05, "torso.z": 0.08, "head.z": 0.14, "head.y": 0.1 };
const PATTED = { ...PAT, "leftForearm.z": 0.8, "rightForearm.z": 0.8 };

const BEATS: Beat<Custom>[] = [
  { at: 0, pose: {} },
  { at: 0.4, pose: {} },
  { at: 0.9, pose: HOLD, ease: "BACK" },
  { at: 1.5, pose: { ...HOLD, unroll: 1 }, ease: "OUT" },
  { at: 2.0, pose: { ...READ, "head.y": 0.12 } },
  { at: 2.35, pose: SPECS },
  { at: 2.6, pose: { ...SPECS, "head.z": -0.12 } },
  { at: 2.9, pose: { ...READ, "head.y": -0.1 } },
  { at: 3.25, pose: GRAB },
  { at: TEAR, pose: GRAB },
  { at: 3.7, pose: RIP, ease: "OUT" },
  { at: 4.1, pose: { ...HOLD, unroll: 0, "head.z": 0 } },
  { at: 4.45, pose: { crouch: 0.15, "rightLeg.z": 0.75, "rightShin.z": -0.9, "leftArm.x": -0.5, "rightArm.x": 0.6, "torso.z": 0.05 } },
  { at: STOMP, pose: { crouch: 0.3, "torso.z": -0.18, "leftArm.x": -0.4, "rightArm.x": 0.4 }, ease: "IN" },
  { at: 5.6, pose: PAT, ease: "BACK" },
  { at: 5.85, pose: { ...PATTED, "head.z": -0.06 } },
  { at: 6.1, pose: PAT },
  { at: 6.35, pose: { ...PATTED, "head.z": -0.08 } },
  { at: 6.6, pose: PAT },
  { at: 7.6, pose: { ...PAT, "head.y": -0.1 } },
  { at: 8.5, pose: {} },
  { at: GRIMBLE_CYCLE, pose: {} },
];

/** Gives Grimble the toll scroll, the tear and the stomp. */
export function performGrimble(rig: TeamRig, scroll: TollScroll, sign: TollSign): (t: number) => void {
  const fx = new Group();
  const scraps = sparkBurst(FICTION.KEY, { count: 14, reach: 0.18, rise: 0.12, fall: 0.25, size: 0.012 });
  const ring = shockwave(FICTION.MOSS, 0.55);
  const dust = dustPuff(CLOTH.SAND, 0.55);
  const pop = sparkBurst(FICTION.GOLD, { count: 22, reach: 0.22, rise: 0.3, fall: 0.2, upward: 0.7, size: 0.01 });
  pop.group.position.set(sign.group.position.x + 0.08, COIN_BASE + TOLL_COINS * COIN_STEP, sign.group.position.z);
  dust.group.position.set(0.05, 0, -0.1);
  ring.group.position.set(0.05, 0.005, -0.1);
  fx.add(scraps.group, ring.group, dust.group, pop.group);
  rig.root.add(fx);
  const hand = new Vector3();
  return (time) => {
    const t = time % GRIMBLE_CYCLE;
    const pose = blend(BEATS, t);
    applyPose(rig, pose);
    /* The scroll hangs from the left fist, facing out; it stays hidden at the belt until it comes out. */
    rig.root.updateMatrixWorld(true);
    rig.root.worldToLocal(rig.leftGrip.getWorldPosition(hand));
    const open = pose("unroll");
    scroll.group.visible = open > 0.02;
    scroll.group.position.copy(hand);
    scroll.group.position.x += 0.06;
    scroll.top.scale.y = Math.max(0.001, open);
    const ripped = t >= TEAR;
    const fly = Math.min(1, Math.max(0, progress(t, TEAR, TEAR + 0.9)));
    scroll.bottom.visible = open > 0.02 && fly < 1;
    if (!ripped) {
      scroll.bottom.position.set(0, (-SCROLL_LENGTH / 2) * open, 0);
      scroll.bottom.rotation.set(0, 0, 0);
      scroll.bottom.scale.set(1, Math.max(0.001, open), 1);
    } else {
      scroll.bottom.position.set(0.25 * fly, -SCROLL_LENGTH / 2 + 0.25 * Math.sin(Math.PI * fly) - 0.3 * fly * fly, -0.35 * fly);
      scroll.bottom.rotation.set(fly * 2.4, fly * 1.2, fly * 3.1);
      scroll.bottom.scale.setScalar(Math.max(0.001, 1 - fly));
    }
    scraps.group.position.set(hand.x + 0.06, hand.y - SCROLL_LENGTH / 2, hand.z);
    scraps.update(progress(t, TEAR, TEAR + 0.6));
    ring.update(progress(t, STOMP - 0.02, STOMP + 0.7));
    dust.update(progress(t, STOMP - 0.02, STOMP + 1.0));
    pop.update(progress(t, STOMP + 0.05, STOMP + 0.8));
    /* The extra coins hop off the stack one after another, and come back as the loop restarts. */
    sign.coins.forEach((piece, i) => {
      if (i < KEPT_COINS) return;
      const k = progress(t, STOMP + 0.05 + (TOLL_COINS - i) * 0.05, STOMP + 0.45 + (TOLL_COINS - i) * 0.05);
      const back = progress(t, GRIMBLE_CYCLE - 0.8, GRIMBLE_CYCLE - 0.2);
      const gone = Math.min(1, Math.max(0, k)) * (1 - Math.min(1, Math.max(0, back)));
      piece.scale.setScalar(Math.max(0.001, 1 - gone));
      piece.position.y = COIN_BASE + i * COIN_STEP + gone * 0.15;
    });
  };
}
