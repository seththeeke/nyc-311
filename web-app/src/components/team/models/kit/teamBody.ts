import { CylinderGeometry, Group } from "three";
import type { ResidentRig } from "../../../residents/models/residentFigure";
import { buildFace, type FaceStyle } from "./teamFace";
import { buildHand } from "./teamHands";
import { buildLeg } from "./teamLegs";

export { heightAboveFloor, placeUpright, worldUpIn } from "./teamHands";
import { satin } from "./teamMaterials";
import { ball, lathe, limb, part } from "./teamShapes";

/*
 * The executives' body (#146): the residents' rig contract (same pivots,
 * so the shared poses still drive it) with knees, elbows, real hands and
 * a turned torso. Stylised at about three heads tall.
 */

/** A team figure: the resident rig, plus hands to hold things and an optional signature motion. */
export interface TeamRig extends ResidentRig {
  leftHand: Group;
  rightHand: Group;
  /* Each hand's grip point, where a held prop's handle goes. */
  leftGrip: Group;
  rightGrip: Group;
  leftForearm: Group;
  rightForearm: Group;
  /* Lower-leg pivots: knee and ankle. */
  leftShin: Group;
  rightShin: Group;
  leftFoot: Group;
  rightFoot: Group;
  /* Everything that leaves the floor in a jump or a flip, pivoting at the hips. Props on `root` stay put. */
  body: Group;
  /** Runs every stage frame after the rest pose: the signature performance, glows, ticks and flutters. */
  animate?: (t: number) => void;
  /* Seconds the performance takes to loop, and the moment to hold when motion is reduced. */
  cycle?: number;
  still?: number;
}

export interface BodyStyle {
  height: number;
  skin: string;
  top: string;
  bottom: string;
  shoes: string;
  hands?: string;
  face: FaceStyle;
  head?: number;
  shoulder?: number;
  hip?: number;
  waist?: number;
  torso?: number;
  legs?: number;
  arms?: number;
  limbs?: number;
  handScale?: number;
  /* Forward bend of each elbow, radians. */
  leftElbow?: number;
  rightElbow?: number;
}

function arm(style: BodyStyle, side: number): { arm: Group; forearm: Group; hand: Group; grip: Group } {
  const length = style.arms ?? 0.46;
  const r = style.limbs ?? 0.055;
  const sleeve = satin(style.top);
  const pivot = new Group();
  pivot.add(part(ball(r * 1.35), sleeve, [0, -0.01, 0]));
  pivot.add(part(limb(length * 0.5, r * 1.1, r * 0.9), sleeve));
  const forearm = new Group();
  forearm.position.set(0, -length * 0.5 + r * 0.6, 0);
  forearm.rotation.z = side > 0 ? (style.leftElbow ?? 0.18) : (style.rightElbow ?? 0.18);
  forearm.add(part(ball(r * 0.92, 16, 12), sleeve));
  forearm.add(part(limb(length * 0.5, r * 0.9, r * 0.72), sleeve));
  const { hand, grip } = buildHand(satin(style.hands ?? style.skin, { roughness: 0.55 }), side, style.handScale ?? 1);
  hand.position.set(0, -length * 0.5, 0);
  forearm.add(hand);
  pivot.add(forearm);
  return { arm: pivot, forearm, hand, grip };
}

/** A complete figure in `style`; the caller dresses it, then adds props to the hands and head. */
export function buildTeamBody(style: BodyStyle): TeamRig {
  const headRadius = style.head ?? 0.24;
  const shoulder = style.shoulder ?? 0.19;
  const hip = style.hip ?? 0.13;
  const waist = style.waist ?? 0.13;
  const torsoLength = style.torso ?? 0.42;
  const hipY = (style.legs ?? 0.5) + 0.07;
  const root = new Group();
  const body = new Group();
  body.position.y = hipY;
  const left = buildLeg(style, hipY);
  const right = buildLeg(style, hipY);
  left.hip.position.z = hip * 0.55;
  right.hip.position.z = -hip * 0.55;
  const torso = new Group();
  const t = torsoLength;
  const shape = lathe([[0.001, -0.07], [hip * 0.85, -0.06], [hip * 1.08, 0.03], [waist, t * 0.45], [shoulder * 0.86, t * 0.74], [shoulder * 0.84, t * 0.9], [shoulder * 0.55, t * 0.99], [0.06, t + 0.01]], 40);
  torso.add(part(shape, satin(style.top), [0, 0, 0], undefined, [0.72, 1, 1]));
  torso.add(part(new CylinderGeometry(0.05, 0.058, 0.12, 20), satin(style.skin), [0, t + 0.03, 0]));
  const head = new Group();
  head.position.set(0, t + 0.04 + headRadius * 0.82, 0);
  head.add(part(ball(headRadius, 48, 32), satin(style.skin, { roughness: 0.55 })));
  head.add(buildFace(headRadius, style.face));
  torso.add(head);
  const leftArm = arm(style, 1);
  const rightArm = arm(style, -1);
  leftArm.arm.position.set(0, t * 0.88, shoulder * 0.98);
  rightArm.arm.position.set(0, t * 0.88, -shoulder * 0.98);
  torso.add(leftArm.arm, rightArm.arm);
  body.add(left.hip, right.hip, torso);
  root.add(body);
  root.scale.setScalar(style.height);
  return {
    root,
    torso,
    head,
    body,
    leftArm: leftArm.arm,
    rightArm: rightArm.arm,
    leftLeg: left.hip,
    rightLeg: right.hip,
    leftShin: left.shin,
    rightShin: right.shin,
    leftFoot: left.foot,
    rightFoot: right.foot,
    leftHand: leftArm.hand,
    rightHand: rightArm.hand,
    leftGrip: leftArm.grip,
    rightGrip: rightArm.grip,
    leftForearm: leftArm.forearm,
    rightForearm: rightArm.forearm,
  };
}

