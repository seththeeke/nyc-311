import { Euler, Matrix4, type Object3D, Quaternion, Vector3 } from "three";
import { poseResident } from "../../../residents/models/residentFigure";
import type { TeamRig } from "./teamBody";
import { settleLegs } from "./teamLegs";

/*
 * Signature performances for the executives (#146): a performance is a
 * list of beats, each a pose at a time in the loop, eased between. A pose
 * turns joints on top of the rest pose, so an empty pose is standing.
 */

export type Joint =
  | "body"
  | "torso"
  | "head"
  | "leftArm"
  | "rightArm"
  | "leftForearm"
  | "rightForearm"
  | "leftHand"
  | "rightHand"
  | "leftLeg"
  | "rightLeg"
  | "leftShin"
  | "rightShin"
  | "leftFoot"
  | "rightFoot";
const JOINTS: readonly Joint[] = ["body", "torso", "head", "leftArm", "rightArm", "leftForearm", "rightForearm", "leftHand", "rightHand", "leftLeg", "rightLeg", "leftShin", "rightShin", "leftFoot", "rightFoot"];
const AXES = ["x", "y", "z"] as const;

/* A joint's turn about one axis in radians; `lift` raises the body; `crouch` bends both knees, feet flat. */
export type Channel = `${Joint}.${(typeof AXES)[number]}` | "lift" | "crouch";
export type Ease = "SMOOTH" | "LINEAR" | "IN" | "OUT" | "BACK";

/** One beat of a performance; `C` names the character's own channels (a prop's flight, a glow). */
export interface Beat<C extends string = never> {
  at: number;
  pose: Partial<Record<Channel | C, number>>;
  /* How the move into this beat is eased. */
  ease?: Ease;
}

export type Posed<C extends string = never> = (channel: Channel | C) => number;

const EASES: Record<Ease, (k: number) => number> = {
  SMOOTH: (k) => k * k * (3 - 2 * k),
  LINEAR: (k) => k,
  IN: (k) => k * k * k,
  OUT: (k) => 1 - (1 - k) ** 3,
  BACK: (k) => 1 + 2.7 * (k - 1) ** 3 + 1.7 * (k - 1) ** 2,
};

/** The pose `t` seconds into the beats, eased between the two either side; it holds the last beat after the end. */
export function blend<C extends string>(beats: readonly Beat<C>[], t: number): Posed<C> {
  let i = 0;
  while (i < beats.length - 2 && t >= beats[i + 1].at) i++;
  const from = beats[i].pose;
  const next = beats[Math.min(i + 1, beats.length - 1)];
  const span = next.at - beats[i].at;
  const k = span > 0 ? EASES[next.ease ?? "SMOOTH"](Math.min(1, Math.max(0, (t - beats[i].at) / span))) : 1;
  const values = new Map<string, number>();
  for (const key of [...Object.keys(from), ...Object.keys(next.pose)] as (Channel | C)[]) {
    const a = from[key] ?? 0;
    values.set(key, a + ((next.pose[key] ?? 0) - a) * k);
  }
  return (channel) => values.get(channel) ?? 0;
}

/** Where `t` sits in a window, 0 at `start` to 1 at `end`; outside it, below 0 or above 1. */
export function progress(t: number, start: number, end: number): number {
  return (t - start) / (end - start);
}

/** Applies a blended pose on top of the rest pose already set this frame. */
export function applyPose<C extends string>(rig: TeamRig, pose: Posed<C>): void {
  for (const joint of JOINTS) for (const axis of AXES) rig[joint].rotation[axis] += pose(`${joint}.${axis}`);
  const bend = pose("crouch");
  for (const [hip, shin, foot] of [[rig.leftLeg, rig.leftShin, rig.leftFoot], [rig.rightLeg, rig.rightShin, rig.rightFoot]] as const) {
    hip.rotation.z += bend;
    shin.rotation.z -= bend * 2;
    foot.rotation.z += bend;
  }
  const leg = -2 * rig.leftShin.position.y;
  rig.body.position.y += pose("lift") - leg * (1 - Math.cos(bend));
}

const REST = new WeakMap<Object3D, { position: Vector3; rotation: Euler }>();

/** Readies a built figure for the stage: lower-leg props onto the shins and feet, and the rest pose remembered. */
export function finishRig(rig: TeamRig): TeamRig {
  if (rig.leftShin.parent === rig.leftLeg) settleLegs(rig);
  for (const joint of JOINTS) REST.set(rig[joint], { position: rig[joint].position.clone(), rotation: rig[joint].rotation.clone() });
  return rig;
}

/** One frame: back to rest, breathing, then the figure's own performance. */
export function poseTeam(rig: TeamRig, t: number): void {
  for (const joint of JOINTS) {
    const rest = REST.get(rig[joint]);
    if (!rest) continue;
    rig[joint].position.copy(rest.position);
    rig[joint].rotation.copy(rest.rotation);
  }
  poseResident(rig, "IDLE", t);
  rig.animate?.(t);
}

/**
 * Puts `item` (a child of the figure's root) `k` of the way from anchor
 * `from` to anchor `to`, arcing `arc` up mid-flight: a prop moving
 * between two hands, or from a hand onto the head.
 */
export function carry(rig: TeamRig, item: Object3D, from: Object3D, to: Object3D, k: number, arc = 0): void {
  rig.root.updateMatrixWorld(true);
  const a = new Matrix4().copy(rig.root.matrixWorld).invert().multiply(from.matrixWorld);
  const b = new Matrix4().copy(rig.root.matrixWorld).invert().multiply(to.matrixWorld);
  const [pa, qa, sa, pb, qb, sb] = [new Vector3(), new Quaternion(), new Vector3(), new Vector3(), new Quaternion(), new Vector3()];
  a.decompose(pa, qa, sa);
  b.decompose(pb, qb, sb);
  item.position.lerpVectors(pa, pb, k);
  item.position.y += Math.sin(Math.PI * k) * arc;
  item.quaternion.slerpQuaternions(qa, qb, k);
  item.scale.lerpVectors(sa, sb, k);
}
