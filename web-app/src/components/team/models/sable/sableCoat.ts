import { Group, Shape, type BufferGeometry } from "three";
import { CLOTH, DETAIL, FICTION } from "../../../residents/models/residentPalette";
import type { TeamRig } from "../kit/teamBody";
import { lacquer, metal, satin } from "../kit/teamMaterials";
import { ball, extrude, lathe, lock, part, ring, rounded, tube } from "../kit/teamShapes";

/*
 * Sable's clothes (#146): a sand trench coat that falls in folds to
 * mid-shin, double-breasted, with notched lapels, epaulettes, a belt
 * with its tail hanging, flapped pockets and strapped cuffs; a white
 * shirt and a loosened dark red tie in the V; charcoal trousers over
 * capped black oxfords.
 */

export const COAT = satin(CLOTH.SAND, { roughness: 0.66, doubleSided: true });
const BUTTON = lacquer(FICTION.LEATHER, 0.3);

/* Ripples a lathed skirt round its circumference, deeper toward the hem, so it hangs in folds. */
function fold(geometry: BufferGeometry, top: number, bottom: number, depth = 0.06): BufferGeometry {
  const position = geometry.attributes.position;
  for (let i = 0; i < position.count; i++) {
    const [x, y, z] = [position.getX(i), position.getY(i), position.getZ(i)];
    const k = Math.min(1, Math.max(0, (top - y) / (top - bottom)));
    const f = 1 + depth * k * Math.sin(8 * Math.atan2(x, z) + 0.6);
    position.setX(i, x * f);
    position.setZ(i, z * f);
  }
  geometry.computeVertexNormals();
  return geometry;
}

function lapelShape(): Shape {
  const shape = new Shape();
  shape.moveTo(0, 0);
  shape.lineTo(0.05, 0.13);
  shape.lineTo(0.035, 0.155);
  shape.lineTo(0.055, 0.17);
  shape.lineTo(0.03, 0.2);
  shape.quadraticCurveTo(0.005, 0.1, 0, 0);
  return shape;
}

function shirtAndTie(rig: TeamRig, t: number): void {
  const shirt = satin(CLOTH.CREAM, { roughness: 0.5 });
  rig.torso.add(part(lathe([[0.1, t * 0.5], [0.12, t * 0.75], [0.1, t * 0.92], [0.06, t * 1.0]], 32, Math.PI / 2 - 0.5, 1.0), shirt, [0.012, 0, 0], undefined, [0.85, 1, 1]));
  for (const side of [1, -1]) rig.torso.add(part(extrude(lapelShape(), 0.004, 0.0015), shirt, [0.075, t * 0.93, side * 0.02], [side * 0.4, side * 0.9, -0.2], [0.45, 0.35, side]));
  const tie = lacquer(CLOTH.RUST, 0.45);
  rig.torso.add(part(ball(0.017, 16, 12), tie, [0.1, t * 0.93, 0.004], undefined, [0.8, 1, 1.1]));
  rig.torso.add(part(lock([[0.104, t * 0.91, 0.004], [0.124, t * 0.8, 0.012], [0.134, t * 0.66, 0.006], [0.136, t * 0.54, 0.0]], 0.011, 0.016, 8), tie));
}

function coatBody(rig: TeamRig, t: number, legs: number): void {
  const body = new Group();
  body.scale.set(0.78, 1, 1);
  const gap = 0.32;
  body.add(part(lathe([[0.152, -0.02], [0.158, t * 0.3], [0.142, t * 0.45], [0.168, t * 0.72], [0.168, t * 0.86], [0.12, t * 0.97], [0.075, t * 1.02]], 64, Math.PI / 2 + gap, Math.PI * 2 - gap * 2), COAT));
  body.add(part(fold(lathe([[0.25, -legs * 0.72], [0.2, -legs * 0.35], [0.165, -0.08], [0.155, 0.0]], 72, Math.PI / 2 + 0.12, Math.PI * 2 - 0.24), 0, -legs * 0.72), COAT));
  rig.torso.add(body);
  for (const side of [1, -1]) {
    rig.torso.add(part(extrude(lapelShape(), 0.008, 0.003), COAT, [0.112, t * 0.56, side * 0.04], [side * 0.28, side * 0.75, -0.16], [1, 1.05, side]));
    for (let i = 0; i < 3; i++) rig.torso.add(part(ball(0.011, 14, 10), BUTTON, [0.13, t * (0.38 + i * 0.1), side * 0.062]));
    const flap = part(rounded(0.012, 0.03, 0.08, 0.008), COAT, [0.075, -0.03, side * 0.16], [0, side * -0.55, 0]);
    rig.torso.add(flap);
    const epaulette = part(rounded(0.1, 0.012, 0.04, 0.006), COAT, [0, t * 0.9, side * 0.165], [side * -0.25, 0, 0]);
    rig.torso.add(epaulette);
    rig.torso.add(part(ball(0.008, 10, 8), BUTTON, [0.045, t * 0.91, side * 0.16]));
  }
  const belt = new Group();
  belt.scale.set(0.78, 1, 1);
  belt.add(part(ring(0.162, 0.014, Math.PI * 2, 8, 64), COAT, [0, t * 0.3, 0], undefined, [1, 1.7, 1]));
  rig.torso.add(belt);
  rig.torso.add(part(ring(0.022, 0.004, Math.PI * 2, 6, 24), metal(FICTION.BRASS, 0.25), [0.13, t * 0.3, 0.02], [0, 0, Math.PI / 2], [1, 1.3, 1]));
  rig.torso.add(part(tube([[0.13, t * 0.3, 0.035], [0.14, t * 0.22, 0.05], [0.135, t * 0.1, 0.055]], 0.01, 6), COAT, [0, 0, 0]));
  rig.torso.add(part(rounded(0.004, 0.022, 0.03, 0.002), satin(CLOTH.CREAM), [0.105, t * 0.66, -0.07], [0, -0.3, 0.1]));
}

function sleevesAndLegs(rig: TeamRig, legs: number): void {
  for (const [arm, forearm] of [[rig.leftArm, rig.leftForearm], [rig.rightArm, rig.rightForearm]] as const) {
    arm.add(part(lathe([[0.056, -0.24], [0.06, -0.12], [0.062, -0.03], [0.045, 0.035]], 32), COAT));
    forearm.add(part(lathe([[0.062, -0.22], [0.058, -0.12], [0.06, -0.02], [0.06, 0.04]], 32), COAT));
    forearm.add(part(rounded(0.012, 0.022, 0.13, 0.008), COAT, [0, -0.18, 0], [Math.PI / 2, 0, 0]));
    forearm.add(part(ring(0.064, 0.008, Math.PI * 2, 6, 32), COAT, [0, -0.215, 0]));
  }
  const wool = satin(CLOTH.CHARCOAL, { roughness: 0.7 });
  for (const [shin, foot] of [[rig.leftShin, rig.leftFoot], [rig.rightShin, rig.rightFoot]] as const) {
    shin.add(part(lathe([[0.072, -legs * 0.43], [0.066, -legs * 0.25], [0.066, 0.02]], 32), wool));
    foot.add(part(rounded(0.09, 0.05, 0.135, 0.03), lacquer(DETAIL.SHOE, 0.3), [0.115, -0.025, 0]));
    foot.add(part(rounded(0.002, 0.003, 0.12, 0.001), satin(DETAIL.EYE), [0.07, -0.01, 0], [0, 0, 0.6]));
  }
}

/** Dresses Sable: coat, shirt and tie, sleeves, trousers and shoes. */
export function dressSable(rig: TeamRig, torso: number, legs: number): void {
  shirtAndTie(rig, torso);
  coatBody(rig, torso, legs);
  sleevesAndLegs(rig, legs);
}
