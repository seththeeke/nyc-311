import { CapsuleGeometry, CylinderGeometry, Group, SphereGeometry, TorusGeometry } from "three";
import { box, mesh, place, solid } from "../../three/threeKit";
import { DETAIL } from "./residentPalette";

/*
 * The shared body every resident model starts from (style guide,
 * 13-customer-simulation.md Appendix P): Mii-like proportions — a big
 * round head on a short, rounded body — in the Mapv2 flat-shaded
 * low-poly look. About 1.4 m, facing +x with y up. Hips, shoulders and
 * the head are pivot groups, so poses are rotations only.
 */

export const BUILDS = ["SLIGHT", "AVERAGE", "BROAD"] as const;
export type Build = (typeof BUILDS)[number];

export interface FigureStyle {
  build: Build;
  /** Overall height scale, 0.9-1.1. */
  height: number;
  skin: string;
  /** Eyebrows; usually the hair colour. */
  brows: string;
  top: string;
  bottom: string;
  shoes?: string;
}

export interface ResidentRig {
  root: Group;
  torso: Group;
  /** The head pivot; hair, hats and glasses go here, and the avatar camera frames it. */
  head: Group;
  leftArm: Group;
  rightArm: Group;
  leftLeg: Group;
  rightLeg: Group;
}

const BUILD_SIZE: Record<Build, { radius: number; limb: number }> = {
  SLIGHT: { radius: 0.17, limb: 0.06 },
  AVERAGE: { radius: 0.2, limb: 0.07 },
  BROAD: { radius: 0.24, limb: 0.08 },
};

export const HIP_HEIGHT = 0.6;
export const HEAD_RADIUS = 0.27;
const TORSO_HEIGHT = 0.4;
/* The head pivot sits this far above the hips; the head overlaps the shoulders, so there is no neck. */
export const HEAD_HEIGHT = TORSO_HEIGHT + 0.27;
/* Where the eyes sit on the head, so glasses and the like line up with them. */
export const EYE_HEIGHT = 0.04;
export const EYE_SPACING = 0.09;
const LEG_LENGTH = 0.42;
const ARM_LENGTH = 0.32;

function limb(length: number, radius: number, color: string): Group {
  const pivot = new Group();
  pivot.add(mesh(new CapsuleGeometry(radius, length, 3, 6), solid(color), [0, -length / 2 - radius, 0]));
  return pivot;
}

/* Big eyes, brows and a small smile on the +x face of the head. */
function face(style: FigureStyle): Group {
  const features = new Group();
  for (const side of [1, -1]) {
    features.add(mesh(new CapsuleGeometry(0.04, 0.04, 2, 8), solid(DETAIL.EYE_WHITE), [HEAD_RADIUS * 0.86, EYE_HEIGHT, side * EYE_SPACING]));
    features.add(mesh(new CapsuleGeometry(0.024, 0.03, 2, 6), solid(DETAIL.EYE), [HEAD_RADIUS * 0.98, EYE_HEIGHT, side * EYE_SPACING]));
    features.add(box(0.014, 0.02, 0.08, solid(style.brows), [HEAD_RADIUS * 0.9, EYE_HEIGHT + 0.08, side * EYE_SPACING]));
  }
  const smile = mesh(new TorusGeometry(0.055, 0.012, 4, 8, Math.PI), solid(DETAIL.EYE), [HEAD_RADIUS * 0.94, -0.08, 0]);
  smile.rotation.set(Math.PI, Math.PI / 2, 0);
  features.add(smile);
  return features;
}

/** A jointed figure in the given clothes and build, with a simple friendly face. */
export function buildFigure(style: FigureStyle): ResidentRig {
  const size = BUILD_SIZE[style.build];
  const root = new Group();
  const leftLeg = place(limb(LEG_LENGTH, size.limb + 0.015, style.bottom), 0, HIP_HEIGHT, size.radius * 0.45);
  const rightLeg = place(limb(LEG_LENGTH, size.limb + 0.015, style.bottom), 0, HIP_HEIGHT, -size.radius * 0.45);
  for (const leg of [leftLeg, rightLeg]) leg.add(box(0.2, 0.08, 0.13, solid(style.shoes ?? DETAIL.SHOE), [0.04, -LEG_LENGTH - 0.13, 0]));

  const torso = place(new Group(), 0, HIP_HEIGHT, 0);
  torso.add(mesh(new CylinderGeometry(size.radius * 0.85, size.radius, TORSO_HEIGHT, 8), solid(style.top), [0, TORSO_HEIGHT / 2, 0]));
  torso.add(mesh(new SphereGeometry(size.radius * 0.85, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2), solid(style.top), [0, TORSO_HEIGHT, 0]));

  const head = place(new Group(), 0, HEAD_HEIGHT, 0);
  head.add(mesh(new SphereGeometry(HEAD_RADIUS, 12, 10), solid(style.skin)));
  head.add(face(style));
  torso.add(head);

  const shoulderZ = size.radius + size.limb * 0.6;
  const leftArm = place(limb(ARM_LENGTH, size.limb, style.top), 0, TORSO_HEIGHT * 0.88, shoulderZ);
  const rightArm = place(limb(ARM_LENGTH, size.limb, style.top), 0, TORSO_HEIGHT * 0.88, -shoulderZ);
  for (const arm of [leftArm, rightArm]) arm.add(mesh(new SphereGeometry(size.limb * 1.2, 6, 5), solid(style.skin), [0, -ARM_LENGTH - size.limb * 2, 0]));
  torso.add(leftArm, rightArm);

  root.add(leftLeg, rightLeg, torso);
  root.scale.setScalar(style.height);
  return { root, torso, head, leftArm, rightArm, leftLeg, rightLeg };
}

/** Hair over the top and back of the head; `depth` is how far down it reaches, 0-1. */
export function hairCap(color: string, depth = 0.45): Group {
  const hair = new Group();
  hair.add(mesh(new SphereGeometry(HEAD_RADIUS + 0.015, 12, 6, 0, Math.PI * 2, 0, Math.PI * depth), solid(color), [-0.02, 0.01, 0]));
  return hair;
}

export const POSES = ["IDLE", "WAVE"] as const;
export type Pose = (typeof POSES)[number];

/**
 * Sets every joint for `pose` at `t` seconds; pure rotations, so it can
 * run every frame. IDLE breathes; WAVE raises the right arm and waves.
 */
export function poseResident(rig: ResidentRig, pose: Pose, t: number): void {
  const breath = Math.sin(t * 2.2);
  rig.torso.rotation.set(0, 0, 0);
  rig.torso.scale.set(1, 1 + breath * 0.012, 1);
  rig.head.rotation.set(0, 0, Math.sin(t * 0.9) * 0.04);
  rig.leftArm.rotation.set(-0.12, 0, 0);
  rig.rightArm.rotation.set(0.12, 0, 0);
  rig.leftLeg.rotation.set(0, 0, 0);
  rig.rightLeg.rotation.set(0, 0, 0);
  if (pose === "WAVE") {
    /* The right arm hangs on the -z side; a positive turn about x swings it up and out. */
    rig.rightArm.rotation.x = 2.5 + Math.sin(t * 7) * 0.35;
    rig.head.rotation.x = -0.08;
  }
}
