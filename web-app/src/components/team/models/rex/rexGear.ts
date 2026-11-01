import { CylinderGeometry, Group, type MeshStandardMaterial } from "three";
import { CLOTH, DETAIL, FICTION, HERO } from "../../../residents/models/residentPalette";
import type { TeamRig } from "../kit/teamBody";
import { lacquer, lamp, metal, satin } from "../kit/teamMaterials";
import { ball, lathe, part, ring, rounded, tube } from "../kit/teamShapes";

/*
 * Rex's power unit and leg armour (#146): a backpack with twin exhaust
 * stacks, cooling fins, hoses over the shoulders and a whip antenna with
 * a blinking tip; a utility belt with tassets; thigh and shin plates,
 * knee domes, calf pistons and heavy boots.
 */

const PAINT = lacquer(CLOTH.OLIVE, 0.45);
const PLATE = metal(FICTION.GUNMETAL, 0.38);
const BRASS = metal(FICTION.BRASS, 0.25);
const HOSE = satin(DETAIL.EYE, { roughness: 0.5 });

/** The backpack; returns the antenna tip so the stage can blink it. */
export function backpack(rig: TeamRig, torso: number): MeshStandardMaterial {
  const pack = new Group();
  pack.position.set(-0.2, torso * 0.62, 0);
  pack.add(part(rounded(0.16, 0.34, 0.34, 0.04, 4), PAINT));
  pack.add(part(rounded(0.02, 0.28, 0.28, 0.01), PLATE, [-0.085, 0, 0]));
  for (let i = 0; i < 7; i++) pack.add(part(rounded(0.03, 0.01, 0.24, 0.003), PLATE, [-0.1, -0.1 + i * 0.033, 0]));
  for (const side of [1, -1]) {
    const stack = new Group();
    stack.position.set(-0.03, 0.17, side * 0.11);
    stack.add(part(lathe([[0.04, 0], [0.042, 0.1], [0.05, 0.12], [0.05, 0.14], [0.036, 0.14]], 32), PLATE));
    stack.add(part(ring(0.044, 0.006, Math.PI * 2, 6, 32), BRASS, [0, 0.06, 0]));
    stack.add(part(new CylinderGeometry(0.033, 0.033, 0.005, 24), metal(DETAIL.EYE, 0.6), [0, 0.13, 0]));
    pack.add(stack);
    /* Hoses from the bottom of the pack, round the hips, into the belt. */
    pack.add(part(tube([[0.0, -0.15, side * 0.15], [0.05, -0.24, side * 0.215], [0.15, -0.27, side * 0.2], [0.24, -0.25, side * 0.15]], 0.014, 10), HOSE));
    pack.add(part(ring(0.019, 0.005, Math.PI * 2, 6, 16), BRASS, [0.04, -0.225, side * 0.21], [0, 0, 0.9]));
  }
  pack.add(part(rounded(0.03, 0.06, 0.12, 0.008), lacquer(CLOTH.MUSTARD, 0.4), [0.0, -0.12, 0.172]));
  pack.add(part(new CylinderGeometry(0.004, 0.007, 0.62, 8), PLATE, [-0.02, 0.45, -0.12], [0.18, 0, 0.12]));
  const tip = lamp(HERO.RED, 2);
  pack.add(part(ball(0.012, 12, 8), tip, [-0.057, 0.755, -0.064]));
  rig.torso.add(pack);
  return tip;
}

export function belt(rig: TeamRig): void {
  const band = new Group();
  band.scale.set(0.78, 1, 1);
  band.add(part(lathe([[0.2, -0.0], [0.205, 0.035], [0.2, 0.07]], 48), PLATE));
  band.add(part(rounded(0.03, 0.06, 0.07, 0.01), BRASS, [0.2, 0.035, 0]));
  for (const a of [0.9, 2.2, -0.9, -2.2]) band.add(part(rounded(0.06, 0.07, 0.05, 0.012), lacquer(FICTION.LEATHER, 0.5), [0.21 * Math.cos(a), 0.02, 0.21 * Math.sin(a)], [0, -a, 0]));
  for (const side of [1, -1]) band.add(part(lathe([[0.22, -0.16], [0.215, -0.06], [0.205, 0.0]], 16, side > 0 ? 0.25 : Math.PI + 0.25, 0.9), PAINT));
  rig.torso.add(band);
}

export function legArmour(rig: TeamRig, hipY: number): void {
  for (const leg of [rig.leftLeg, rig.rightLeg]) {
    leg.add(part(lathe([[0.1, -0.02], [0.112, -0.1], [0.105, -0.22]], 32, Math.PI / 2 - 1.3, 2.6), PAINT));
    leg.add(part(ball(0.075, 24, 16), PAINT, [0.035, -0.27, 0], undefined, [0.8, 0.9, 0.9]));
    leg.add(part(ring(0.06, 0.008, Math.PI * 2, 8, 24), BRASS, [0.06, -0.27, 0], [0, 0, Math.PI / 2]));
    leg.add(part(lathe([[0.1, -hipY + 0.17], [0.11, -0.4], [0.105, -0.32]], 32, Math.PI / 2 - 1.2, 2.4), PAINT));
    leg.add(part(new CylinderGeometry(0.014, 0.014, 0.16, 16), PLATE, [-0.09, -0.4, 0]));
    leg.add(part(new CylinderGeometry(0.007, 0.007, 0.14, 12), metal(DETAIL.STEEL, 0.15), [-0.09, -0.28, 0]));
    leg.add(part(lathe([[0.12, -hipY], [0.125, -hipY + 0.05], [0.11, -hipY + 0.16]], 32), PLATE));
    leg.add(part(rounded(0.3, 0.1, 0.17, 0.04, 4), PAINT, [0.06, -hipY + 0.06, 0]));
    leg.add(part(rounded(0.31, 0.025, 0.18, 0.01), metal(DETAIL.EYE, 0.6), [0.06, -hipY + 0.012, 0]));
    leg.add(part(ring(0.115, 0.01, Math.PI * 2, 8, 32), BRASS, [0, -hipY + 0.16, 0]));
  }
}
