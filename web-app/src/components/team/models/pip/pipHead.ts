import { CylinderGeometry, Group, Shape } from "three";
import { FICTION } from "../../../residents/models/residentPalette";
import { onHead } from "../kit/teamFace";
import { glass, metal, satin } from "../kit/teamMaterials";
import { ball, extrude, lathe, lock, part, ring, type Vec3 } from "../kit/teamShapes";

/*
 * Pip's hat and beard (#146): a tall red gnome hat whose tip droops over,
 * with a rolled brim, brass goggles pushed up on it and a cog badge; and
 * a big white beard, moustache and tufts, all in tapered locks.
 */

const WHITE = satin(FICTION.BEARD, { roughness: 0.9 });

export function gearShape(radius: number, teeth = 10): Shape {
  const shape = new Shape();
  for (let i = 0; i < teeth * 4; i++) {
    const a = (i / (teeth * 4)) * Math.PI * 2;
    const r = i % 4 < 2 ? radius : radius * 0.78;
    if (i === 0) shape.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    else shape.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  shape.closePath();
  const hole = new Shape();
  hole.absarc(0, 0, radius * 0.32, 0, Math.PI * 2, true);
  shape.holes.push(hole);
  return shape;
}

/** The hat, sitting on a head of radius `r`; each segment bends a little further than the last. */
export interface Hat {
  hat: Group;
  /* The goggles, pivoting about the middle of the head: turn them down about z to pull them over his eyes. */
  goggles: Group;
}

/** The hat, and its goggles on their own pivot; add both to the head. */
export function buildHat(r: number): Hat {
  const hat = new Group();
  hat.position.set(-0.01, r * 0.45, 0);
  hat.rotation.z = 0.08;
  const felt = satin(FICTION.GNOME_HAT, { roughness: 0.75 });
  hat.add(part(ring(r * 0.98, 0.035, Math.PI * 2, 12, 64), felt, [0, 0, 0]));
  let segment = hat;
  const radii = [r * 0.97, r * 0.82, r * 0.66, r * 0.5, r * 0.36, r * 0.23, r * 0.12, r * 0.03];
  for (let i = 0; i < radii.length - 1; i++) {
    const next = new Group();
    next.position.y = i === 0 ? 0 : 0.11;
    next.rotation.z = i < 2 ? 0 : -0.22 - i * 0.04;
    next.add(part(lathe([[radii[i], 0], [radii[i + 1], 0.115]], 40), felt));
    segment.add(next);
    segment = next;
  }
  segment.add(part(ball(0.025, 16, 12), felt, [0, 0.115, 0]));
  /* Goggles on the front of the hat: strap, two brass rims, tinted lenses. */
  hat.add(part(ring(r * 0.99, 0.014, Math.PI * 2, 8, 64), satin(FICTION.LEATHER, { roughness: 0.6 }), [0, 0.06, 0]));
  const goggles = new Group();
  const onBrim = new Group();
  onBrim.position.copy(hat.position);
  onBrim.rotation.copy(hat.rotation);
  goggles.add(onBrim);
  for (const side of [1, -1]) {
    const lens = new Group();
    lens.position.set(r * 0.88, 0.07, side * 0.085);
    lens.rotation.set(0, side * -0.35, -Math.PI / 2 + 0.25);
    lens.add(part(new CylinderGeometry(0.058, 0.062, 0.045, 32), metal(FICTION.BRASS, 0.22)));
    lens.add(part(ring(0.06, 0.008, Math.PI * 2, 8, 32), metal(FICTION.BRASS, 0.18), [0, 0.024, 0]));
    lens.add(part(ball(0.05, 24, 12), glass(FICTION.CRYSTAL, 0.55), [0, 0.02, 0], undefined, [1, 0.35, 1]));
    onBrim.add(lens);
  }
  onBrim.add(part(new CylinderGeometry(0.012, 0.012, 0.04, 12), metal(FICTION.BRASS, 0.2), [r * 0.97, 0.07, 0], [Math.PI / 2, 0, 0]));
  hat.add(part(extrude(gearShape(0.04), 0.012, 0.002), metal(FICTION.BRASS, 0.25), [r * 0.62, 0.2, r * 0.42], [0, -0.8, -0.35]));
  return { hat, goggles };
}

function strand(head: Group, points: Vec3[], start: number, end: number): void {
  head.add(part(lock(points, start, end, 10), WHITE));
}

export function buildBeard(head: Group, r: number): void {
  head.add(part(ball(r * 0.82, 32, 20), WHITE, [r * 0.16, -r * 0.5, 0], undefined, [0.85, 0.75, 1.0]));
  for (let i = 0; i < 19; i++) {
    const t = i / 18;
    const centre = 1 - Math.abs(t - 0.5) * 2;
    const across = (t - 0.5) * 2.4;
    const start = onHead(r, -0.3 - centre * 0.2, across, 0);
    const length = r * (0.7 + centre * 0.95);
    strand(head, [start, [start[0] + 0.06, start[1] - length * 0.5, start[2] * 0.85], [start[0] + 0.02 + centre * 0.03, start[1] - length, start[2] * 0.5 + Math.sin(i * 1.9) * 0.015]], 0.05, 0.016);
  }
  for (const side of [1, -1]) {
    for (let k = 0; k < 3; k++) {
      const start = onHead(r, -0.22 - k * 0.02, side * (0.04 + k * 0.03), 0.04);
      strand(head, [start, [start[0] + 0.02, start[1] - 0.02, side * (0.11 + k * 0.01)], [start[0] - 0.01, start[1] + 0.02, side * (0.19 + k * 0.012)]], 0.03 - k * 0.004, 0.008);
    }
    for (let k = 0; k < 4; k++) {
      const start = onHead(r, 0.18 - k * 0.08, side * (1.3 + k * 0.08), 0);
      strand(head, [start, onHead(r, 0.1 - k * 0.1, side * (1.45 + k * 0.08), 0.06), onHead(r, -0.05 - k * 0.12, side * (1.55 + k * 0.1), 0.1)], 0.03, 0.006);
    }
  }
}
