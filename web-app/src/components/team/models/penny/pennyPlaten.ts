import { CapsuleGeometry, CylinderGeometry, Group, type Material } from "three";
import { DETAIL, FACE, FICTION, HERO, CLOTH } from "../../../residents/models/residentPalette";
import type { TeamRig } from "../kit/teamBody";
import { lacquer, metal, satin } from "../kit/teamMaterials";
import { ball, lathe, part, ring, rounded, tube } from "../kit/teamShapes";
import { buildTypewriter } from "./pennyMachine";
import { buildProjector } from "./pennyProjector";
import { PENNY_CYCLE, PENNY_STILL, performPenny } from "./pennyMotion";
import { buildSheet } from "./pennySheet";

/*
 * Penny Platen, Chief of Staff (#146): a cheerful 1950s cartoon mascot of
 * a typewriter, projected as a hologram from a brass desk console. Rubber-
 * hose arms and legs, white cartoon gloves, Mary Janes and a pencil for
 * the minutes. On stage she types to the bell, slams the carriage back
 * and wags a finger at you (pennyMotion).
 */

const HIP = 0.62;
const FLOOR = 0.086;
const HOSE = satin(DETAIL.EYE, { roughness: 0.45 });

function glove(side: number): { hand: Group; grip: Group } {
  const white: Material = satin(FICTION.GLOVE, { roughness: 0.5 });
  const hand = new Group();
  hand.add(part(lathe([[0.022, 0.02], [0.034, 0.0], [0.042, -0.02], [0.03, -0.03]], 24), white));
  hand.add(part(ball(0.045, 24, 16), white, [0, -0.06, 0], undefined, [0.85, 1, 0.65]));
  for (let i = 0; i < 3; i++) {
    const finger = part(new CapsuleGeometry(0.016, 0.035, 6, 12), white, [0.025 - i * 0.025, -0.11, -side * 0.012], [side * 0.6, 0, (1 - i) * 0.15]);
    hand.add(finger);
  }
  hand.add(part(new CapsuleGeometry(0.016, 0.03, 6, 12), white, [0.045, -0.06, -side * 0.02], [-side * 0.4, 0, 0.9]));
  for (const dx of [-0.016, 0, 0.016]) hand.add(part(tube([[dx, -0.04, side * 0.027], [dx, -0.075, side * 0.03]], 0.0022, 4), HOSE));
  const grip = new Group();
  grip.position.set(0, -0.1, -side * 0.03);
  hand.add(grip);
  return { hand, grip };
}

function hoseArm(side: number): { arm: Group; forearm: Group; hand: Group; grip: Group } {
  const arm = new Group();
  arm.add(part(tube([[0, 0, 0], [0, -0.08, side * 0.03], [0, -0.17, side * 0.03]], 0.018), HOSE));
  const forearm = new Group();
  forearm.position.set(0, -0.17, side * 0.03);
  forearm.rotation.z = 0.25;
  forearm.add(part(tube([[0, 0, 0], [0, -0.09, -side * 0.015], [0, -0.17, 0]], 0.018), HOSE));
  const { hand, grip } = glove(side);
  hand.position.set(0, -0.17, 0);
  forearm.add(hand);
  arm.add(forearm);
  return { arm, forearm, hand, grip };
}

function hoseLeg(side: number): Group {
  const leg = new Group();
  leg.position.set(0, 0, side * 0.14);
  const drop = HIP - FLOOR;
  leg.add(part(tube([[0, 0, 0], [0.03, -drop * 0.45, side * 0.02], [0, -drop + 0.07, 0]], 0.02), HOSE));
  leg.add(part(ring(0.026, 0.012, Math.PI * 2, 8, 24), satin(FICTION.GLOVE), [0, -drop + 0.075, 0]));
  const shoe = lacquer(HERO.RED, 0.25);
  leg.add(part(rounded(0.13, 0.05, 0.085, 0.024), shoe, [0.02, -drop + 0.025, 0]));
  leg.add(part(ball(0.045, 20, 14), shoe, [0.075, -drop + 0.028, 0], undefined, [1, 0.6, 0.95]));
  leg.add(part(ring(0.045, 0.006, Math.PI, 6, 16), shoe, [0.01, -drop + 0.05, 0], [0, 0, Math.PI / 2]));
  leg.add(part(ball(0.008, 10, 8), metal(FICTION.BRASS, 0.2), [0.01, -drop + 0.05, side * 0.045]));
  return leg;
}

/** A yellow pencil with a pink eraser, for the minutes. */
function pencil(): Group {
  const group = new Group();
  group.rotation.set(0, 0, 0.3);
  group.add(part(new CylinderGeometry(0.008, 0.008, 0.16, 6), satin(CLOTH.MUSTARD, { roughness: 0.5 })));
  group.add(part(new CylinderGeometry(0.0085, 0.0085, 0.015, 12), metal(DETAIL.STEEL, 0.3), [0, 0.085, 0]));
  group.add(part(new CapsuleGeometry(0.008, 0.01, 4, 8), satin(FACE.BLUSH), [0, 0.1, 0]));
  group.add(part(new CylinderGeometry(0.0, 0.008, 0.025, 6), satin(CLOTH.SAND), [0, -0.092, 0]));
  return group;
}

export function buildPennyPlaten(): TeamRig {
  const root = new Group();
  const projector = buildProjector(1.5);
  root.add(projector.group);
  const body = new Group();
  body.position.y = HIP;
  root.add(body);
  const torso = new Group();
  const machine = buildTypewriter();
  torso.add(machine.body);
  const head = new Group();
  head.position.set(-0.12, 0.7, 0);
  buildSheet(head);
  torso.add(head);
  const left = hoseArm(1);
  const right = hoseArm(-1);
  left.arm.position.set(0, 0.2, 0.31);
  right.arm.position.set(0, 0.2, -0.31);
  torso.add(left.arm, right.arm);
  left.grip.add(pencil());
  const leftLeg = hoseLeg(1);
  const rightLeg = hoseLeg(-1);
  body.add(leftLeg, rightLeg, torso);
  const rig: TeamRig = {
    root,
    body,
    torso,
    head,
    leftArm: left.arm,
    rightArm: right.arm,
    leftLeg,
    rightLeg,
    /* Rubber hose has no knees: these pivots hold nothing. */
    leftShin: new Group(),
    rightShin: new Group(),
    leftFoot: new Group(),
    rightFoot: new Group(),
    leftHand: left.hand,
    rightHand: right.hand,
    leftGrip: left.grip,
    rightGrip: right.grip,
    leftForearm: left.forearm,
    rightForearm: right.forearm,
  };
  rig.animate = performPenny(rig, machine, projector);
  rig.cycle = PENNY_CYCLE;
  rig.still = PENNY_STILL;
  return rig;
}
