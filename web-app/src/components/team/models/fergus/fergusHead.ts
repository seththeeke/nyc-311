import { Group } from "three";
import { DETAIL, FICTION, HAIR } from "../../../residents/models/residentPalette";
import { onHead } from "../kit/teamFace";
import { lacquer, metal, satin } from "../kit/teamMaterials";
import { ball, lathe, lock, part, rounded, type Vec3 } from "../kit/teamShapes";

/*
 * Fergus's hat and whiskers (#146): a tall green hat that flares at the
 * crown, with a curled brim, a black band, a big gold buckle and a
 * shamrock tucked in; ginger mutton chops joining under the chin, bushy
 * brows and tufts of hair under the brim.
 */

const GINGER = satin(FICTION.GINGER, { roughness: 0.85 });
const SHAMROCK = satin(FICTION.SHAMROCK, { roughness: 0.55 });
const GINGER_LIGHT = satin(HAIR.AUBURN, { roughness: 0.85 });

function shamrock(): Group {
  const sprig = new Group();
  for (let i = 0; i < 3; i++) {
    const leaf = new Group();
    leaf.rotation.x = (i - 1) * 1.1;
    for (const side of [1, -1]) leaf.add(part(ball(0.018, 14, 10), SHAMROCK, [0, 0.03, side * 0.011], undefined, [0.35, 1, 0.8]));
    sprig.add(leaf);
  }
  sprig.add(part(lock([[0, 0, 0], [0, -0.03, 0.005], [0, -0.05, 0.015]], 0.004, 0.002, 6), SHAMROCK));
  return sprig;
}

export function buildHat(): Group {
  const hat = new Group();
  const felt = lacquer(FICTION.SHAMROCK, 0.6);
  hat.add(part(lathe([[0.001, 0.0], [0.3, 0.0], [0.335, 0.012], [0.345, 0.035], [0.33, 0.04], [0.29, 0.022], [0.2, 0.02]], 64), felt));
  hat.add(part(lathe([[0.2, 0.02], [0.188, 0.12], [0.195, 0.24], [0.215, 0.33], [0.2, 0.345], [0.001, 0.35]], 64), felt));
  hat.add(part(lathe([[0.197, 0.03], [0.193, 0.1]], 64), satin(DETAIL.EYE, { roughness: 0.4 })));
  const buckle = new Group();
  buckle.position.set(0.2, 0.065, 0);
  const gold = metal(FICTION.GOLD, 0.18);
  for (const [y, z, h, w] of [[0.035, 0, 0.014, 0.1], [-0.035, 0, 0.014, 0.1], [0, 0.044, 0.084, 0.014], [0, -0.044, 0.084, 0.014]]) {
    buckle.add(part(rounded(0.016, h, w, 0.005), gold, [0, y, z]));
  }
  buckle.add(part(rounded(0.01, 0.06, 0.008, 0.003), gold, [0.006, 0, 0]));
  hat.add(buckle);
  const sprig = shamrock();
  sprig.position.set(0.1, 0.11, 0.17);
  sprig.rotation.set(0.4, 0, -0.2);
  hat.add(sprig);
  return hat;
}

/* A clump of short locks fanning from one spot. */
function tuft(head: Group, start: Vec3, toward: Vec3, count: number, length: number): void {
  for (let k = 0; k < count; k++) {
    const spread = (k - (count - 1) / 2) * 0.025;
    const end: Vec3 = [start[0] + toward[0] * length + spread * 0.3, start[1] + toward[1] * length + spread, start[2] + toward[2] * length + spread * 0.5];
    const mid: Vec3 = [(start[0] + end[0]) / 2 + 0.01, (start[1] + end[1]) / 2 + 0.01, (start[2] + end[2]) / 2];
    head.add(part(lock([start, mid, end], 0.028, 0.005, 8), GINGER));
  }
}

export function buildWhiskers(head: Group, r: number): void {
  head.add(part(ball(r * 0.86, 32, 20), GINGER, [r * 0.12, -r * 0.48, 0], undefined, [0.85, 0.7, 1.04]));
  /* Mutton chops in two layers of finer locks, meeting in a fluffy fringe under the chin. */
  for (let layer = 0; layer < 3; layer++) {
    const count = 26 - layer * 5;
    for (let i = 0; i < count; i++) {
      const t = i / (count - 1);
      const centre = 1 - Math.abs(t - 0.5) * 2;
      const across = (t - 0.5) * (2.8 - layer * 0.3);
      const up = -0.12 - centre * 0.5 - layer * 0.06;
      const wobble = Math.sin(i * 2.7 + layer * 1.3) * 0.035;
      const start = onHead(r, up, across, -0.01 + layer * 0.02);
      const mid = onHead(r, up - 0.2, across * 0.99 + wobble, 0.03 + layer * 0.015);
      const end = onHead(r, up - 0.42 - centre * 0.08, across * 1.0 + wobble * 2, 0.012 + layer * 0.02);
      head.add(part(lock([start, mid, end], 0.034 - layer * 0.005, 0.012, 8), layer === 1 ? GINGER_LIGHT : GINGER));
    }
  }
  for (const side of [1, -1]) {
    tuft(head, onHead(r, 0.36, side * 0.3, 0.01), [0.25, 0.35, side * 0.6], 3, 0.06);
    tuft(head, onHead(r, 0.25, side * 1.4, 0), [-0.3, -0.2, side * 0.8], 4, 0.08);
  }
  tuft(head, onHead(r, 0.2, Math.PI, 0), [-0.8, -0.3, 0], 5, 0.09);
}
