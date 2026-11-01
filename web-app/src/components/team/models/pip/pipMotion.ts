import { Group, Quaternion, Vector3 } from "three";
import { FICTION } from "../../../residents/models/residentPalette";
import type { TeamRig } from "../kit/teamBody";
import { sparkBurst } from "../kit/teamEffects";
import { metal } from "../kit/teamMaterials";
import { applyPose, type Beat, blend, progress } from "../kit/teamMotion";
import { extrude, part, ring } from "../kit/teamShapes";
import { gearShape } from "./pipHead";
import type { Stopwatch } from "./pipTools";

/*
 * Pip's signature (#146): goggles down, then he cranks a stuck brass gear
 * with the big wrench, three hard turns in a spray of sparks, until it
 * spins free and pops away. Goggles up, a click of the stopwatch, and a
 * little hop of triumph.
 */

type Custom = "goggles" | "gear" | "turn" | "aim";

export const PIP_CYCLE = 9.2;
export const PIP_STILL = 2.35;
const CRANKS = [1.6, 2.4, 3.2] as const;
const CLICK = 5.6;
/* The gear's axle in front of him (torso space), where the wrench's jaw bites. */
const AXLE: [number, number, number] = [0.3, 0.08, 0.2];

/* Hand angles solved: reaching up to the goggles, the two ends of a crank stroke and the stopwatch; both fists flung up and out by eye. */
const EYES = { "rightArm.x": -0.02, "rightArm.z": 2.3, "rightForearm.z": -0.08 };
const UP = { "leftArm.x": -1.68, "leftArm.z": 0.3, "leftForearm.z": 1.2, aim: 1, gear: 1, crouch: 0.12, "torso.z": -0.1, "head.z": -0.15, "head.y": -0.3, goggles: 1 };
const DOWN = { ...UP, "leftArm.x": -1.08, "leftArm.z": 0.7, "leftForearm.z": 0, "torso.z": -0.16 };
const CHEER = { "leftArm.x": -2.3, "leftArm.z": 0.35, "leftForearm.z": 0.3, "rightArm.x": 2.3, "rightArm.z": 0.35, "rightForearm.z": 0.3, "head.z": 0.15 };

const BEATS: Beat<Custom>[] = [
  { at: 0, pose: {} },
  { at: 0.5, pose: { ...EYES, "head.z": 0.1 }, ease: "BACK" },
  { at: 0.85, pose: { ...EYES, "rightArm.z": 2.0, "head.z": -0.25, goggles: 1 }, ease: "OUT" },
  { at: 1.2, pose: { ...UP, gear: 1 }, ease: "BACK" },
  { at: CRANKS[0], pose: { ...DOWN, turn: 1 }, ease: "IN" },
  { at: 2.0, pose: { ...UP, turn: 1 } },
  { at: CRANKS[1], pose: { ...DOWN, turn: 2 }, ease: "IN" },
  { at: 2.8, pose: { ...UP, turn: 2 } },
  { at: CRANKS[2], pose: { ...DOWN, turn: 3 }, ease: "IN" },
  { at: 3.6, pose: { gear: 1, turn: 4, goggles: 1, "torso.z": 0.06, "head.z": 0.08 } },
  { at: 4.3, pose: { gear: 1, turn: 9, goggles: 1, "torso.z": 0.06, "head.z": 0.12 }, ease: "LINEAR" },
  { at: 4.6, pose: { gear: 0, turn: 11, goggles: 1 }, ease: "IN" },
  { at: 5.0, pose: { ...EYES, "head.z": 0.1 } },
  { at: 5.3, pose: { "rightArm.x": 1.28, "rightArm.y": -0.2, "rightArm.z": 0.6, "rightForearm.z": 1.52, "head.z": -0.3, "head.y": 0.3 } },
  { at: 6.0, pose: { "rightArm.x": 1.28, "rightArm.y": -0.2, "rightArm.z": 0.6, "rightForearm.z": 1.52, "head.z": -0.25, "head.y": 0.25 } },
  { at: 6.35, pose: { crouch: 0.4, "torso.z": -0.15, "leftArm.z": -0.4, "rightArm.z": -0.4 } },
  { at: 6.6, pose: { ...CHEER, lift: 0.18 }, ease: "OUT" },
  { at: 6.85, pose: { ...CHEER, crouch: 0.28 }, ease: "IN" },
  { at: 7.3, pose: CHEER },
  { at: 8.2, pose: {} },
  { at: PIP_CYCLE, pose: {} },
];

function gear(): Group {
  const group = new Group();
  group.position.set(...AXLE);
  group.userData.fx = true;
  const spin = new Group();
  spin.add(part(extrude(gearShape(0.13, 12), 0.03, 0.004), metal(FICTION.BRASS, 0.25), [-0.015, 0, 0]));
  spin.add(part(ring(0.035, 0.012, Math.PI * 2, 8, 6), metal(FICTION.GUNMETAL, 0.3), [0.02, 0, 0], [0, 0, Math.PI / 2]));
  group.add(spin);
  return group;
}

/** Gives Pip his gear-cranking routine. */
export function performPip(rig: TeamRig, goggles: Group, wrench: Group, watch: Stopwatch): (t: number) => void {
  const holder = new Group();
  rig.leftGrip.add(holder);
  holder.add(wrench);
  const cog = gear();
  rig.torso.add(cog);
  const sparks = sparkBurst(FICTION.EMBER, { count: 16, reach: 0.22, rise: 0.2, fall: 0.15, size: 0.01 });
  sparks.group.position.set(...AXLE);
  const pop = sparkBurst(FICTION.STAR, { count: 18, reach: 0.25, rise: 0.25, fall: 0.05, size: 0.01 });
  pop.group.position.set(...AXLE);
  const ding = sparkBurst(FICTION.STAR, { count: 10, reach: 0.1, rise: 0.12, fall: 0.02, size: 0.007 });
  ding.group.position.copy(watch.group.position);
  rig.torso.add(sparks.group, pop.group, ding.group);
  const [axle, grip, dir, aimed, gripTurn] = [new Vector3(), new Vector3(), new Vector3(), new Quaternion(), new Quaternion()];
  return (time) => {
    const t = time % PIP_CYCLE;
    const pose = blend(BEATS, t);
    applyPose(rig, pose);
    goggles.rotation.z = -0.5 * pose("goggles");
    cog.scale.setScalar(Math.max(0.001, pose("gear")));
    cog.children[0].rotation.x = (pose("turn") * Math.PI) / 6;
    /* The wrench swings round in his fist to keep its jaw on the axle. */
    rig.root.updateMatrixWorld(true);
    rig.torso.localToWorld(axle.set(...AXLE));
    dir.subVectors(axle, rig.leftGrip.getWorldPosition(grip)).normalize();
    aimed.setFromUnitVectors(new Vector3(0, -1, 0), dir);
    holder.quaternion.copy(rig.leftGrip.getWorldQuaternion(gripTurn).invert().multiply(aimed));
    holder.quaternion.slerp(new Quaternion(), 1 - pose("aim"));
    const stroke = CRANKS.map((at) => progress(t, at - 0.05, at + 0.45)).find((k) => k > 0 && k < 1) ?? -1;
    sparks.update(stroke);
    pop.update(progress(t, 4.45, 5.1));
    ding.update(progress(t, CLICK, CLICK + 0.5));
    watch.hand.rotation.x = t > CLICK && t < 6.3 ? 0 : -Math.floor(time * 4) * (Math.PI / 30);
  };
}
