import { CylinderGeometry, Group, SphereGeometry, type BufferGeometry } from "three";
import { CLOTH, FACE, FICTION } from "../../../residents/models/residentPalette";
import { onHead } from "../kit/teamFace";
import { glass, metal, satin } from "../kit/teamMaterials";
import { ball, lock, part, ring, tube, type Vec3 } from "../kit/teamShapes";

/*
 * Grimble's head (#146): a broad two-tone muzzle with an underbite and
 * curved tusks, a heavy brow ridge, a big drooping nose, swept-back ears,
 * a cap of moss with a mushroom and a fern growing in it, and wire
 * spectacles perched on the nose.
 */

export const HIDE = satin(FICTION.TROLL, { roughness: 0.62 });
const PALE = satin(FICTION.TROLL_LIGHT, { roughness: 0.6 });
const IVORY = satin(FICTION.BEARD, { roughness: 0.35 });
const MOSS = satin(FICTION.MOSS, { roughness: 0.95 });

/* Roughens a moss cap so it reads as a soft, lumpy growth rather than a smooth shell. */
function lumpy(geometry: BufferGeometry, amount: number): BufferGeometry {
  const position = geometry.attributes.position;
  for (let i = 0; i < position.count; i++) {
    const [x, y, z] = [position.getX(i), position.getY(i), position.getZ(i)];
    const k = 1 + amount * Math.abs(Math.sin(x * 61 + z * 17) * Math.sin(z * 53 - y * 11) + 0.5 * Math.sin(y * 89 + x * 7));
    position.setXYZ(i, x * k, y * k, z * k);
  }
  geometry.computeVertexNormals();
  return geometry;
}

function muzzle(head: Group, r: number): void {
  head.add(part(ball(r * 0.52, 40, 28), PALE, [r * 0.5, -r * 0.4, 0], undefined, [0.86, 0.6, 0.96]));
  head.add(part(ball(r * 0.4, 36, 24), PALE, [r * 0.6, -r * 0.6, 0], undefined, [0.8, 0.4, 0.95]));
  const lip: Vec3[] = [-1, -0.5, 0, 0.5, 1].map((t) => [r * (0.94 - t * t * 0.1), -r * (0.47 + 0.05 * (1 - t * t)), t * r * 0.32]);
  head.add(part(tube(lip, r * 0.022, 8), satin(FACE.LIP, { roughness: 0.5 })));
  for (const side of [1, -1]) {
    head.add(part(lock([[r * 0.86, -r * 0.56, side * r * 0.24], [r * 0.95, -r * 0.42, side * r * 0.28], [r * 0.9, -r * 0.3, side * r * 0.34]], 0.02, 0.004, 12), IVORY));
    head.add(part(ball(r * 0.22, 24, 16), HIDE, onHead(r, -0.18, side * 0.58, -0.03), undefined, [0.7, 0.8, 1]));
  }
}

function nose(head: Group, r: number): void {
  head.add(part(ball(r * 0.2, 32, 24), HIDE, [r * 1.02, -r * 0.14, 0], undefined, [1, 1.2, 1.15]));
  head.add(part(ball(r * 0.13, 24, 16), HIDE, [r * 0.95, r * 0.02, 0], undefined, [1, 1.3, 0.9]));
  for (const side of [1, -1]) head.add(part(ball(r * 0.05, 12, 8), satin(FICTION.MOSS, { roughness: 0.8 }), [r * 1.1, -r * 0.24, side * r * 0.08], undefined, [0.6, 0.7, 1]));
  head.add(part(ball(r * 0.035, 12, 8), PALE, [r * 1.16, -r * 0.06, r * 0.1]));
}

function browAndEars(head: Group, r: number): void {
  head.add(part(ball(r * 0.52, 40, 20), HIDE, [r * 0.62, r * 0.3, 0], undefined, [0.5, 0.3, 1.2]));
  for (const side of [1, -1]) {
    const ear = new Group();
    ear.scale.set(0.42, 1, 1);
    ear.add(part(lock([[-r * 0.04, r * 0.02, side * r * 0.9], [-r * 0.14, r * 0.12, side * r * 1.3], [-r * 0.34, r * 0.22, side * r * 1.78]], r * 0.2, r * 0.02, 16), HIDE));
    ear.add(part(lock([[r * 0.06, r * 0.02, side * r * 0.95], [-r * 0.04, r * 0.11, side * r * 1.3], [-r * 0.22, r * 0.19, side * r * 1.62]], r * 0.12, r * 0.015, 12), satin(FACE.LIP, { roughness: 0.8 })));
    head.add(ear);
  }
}

function mossCap(head: Group, r: number): void {
  head.add(part(lumpy(new SphereGeometry(r + 0.014, 64, 24, 0, Math.PI * 2, 0, Math.PI * 0.34), 0.025), MOSS, [-0.01, 0.0, 0]));
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    head.add(part(ball(0.026 + (i % 3) * 0.006, 14, 10), MOSS, onHead(r, 0.98 + (i % 2) * 0.06, a, 0.004)));
  }
  const mushroom = new Group();
  mushroom.position.set(...onHead(r, 1.15, -0.9, 0.01));
  mushroom.rotation.set(0.4, 0, -0.25);
  mushroom.add(part(new CylinderGeometry(0.009, 0.013, 0.06, 12), satin(CLOTH.CREAM, { roughness: 0.7 }), [0, 0.03, 0]));
  mushroom.add(part(new SphereGeometry(0.032, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), satin(CLOTH.RUST, { roughness: 0.5 }), [0, 0.055, 0], undefined, [1, 0.75, 1]));
  for (let i = 0; i < 5; i++) mushroom.add(part(ball(0.005, 8, 6), satin(CLOTH.CREAM), [Math.cos(i * 1.3) * 0.022, 0.07 - (i % 2) * 0.008, Math.sin(i * 1.3) * 0.022]));
  head.add(mushroom);
  for (const lean of [-0.35, 0.3]) {
    const start = onHead(r, 1.2, 0.8 + lean, 0.0);
    head.add(part(lock([start, [start[0] + 0.02, start[1] + 0.07, start[2] + lean * 0.05], [start[0] - 0.01, start[1] + 0.11, start[2] + lean * 0.12]], 0.01, 0.003, 8), satin(FICTION.SHAMROCK, { roughness: 0.7 })));
  }
}

/** Round wire spectacles on the bridge of the nose, temples back to the ears. */
function spectacles(head: Group, r: number): void {
  const wire = metal(FICTION.BRASS, 0.18);
  for (const side of [1, -1]) {
    const lens = new Group();
    lens.position.set(r * 1.0, r * 0.06, side * r * 0.33);
    lens.rotation.set(0, side * -0.3, Math.PI / 2);
    lens.add(part(ring(r * 0.16, 0.0035, Math.PI * 2, 8, 40), wire));
    lens.add(part(new CylinderGeometry(r * 0.156, r * 0.156, 0.002, 40), glass(FICTION.CRYSTAL, 0.25)));
    head.add(lens);
    head.add(part(tube([[r * 0.95, r * 0.08, side * r * 0.48], [r * 0.62, r * 0.1, side * r * 0.86], [r * 0.12, r * 0.06, side * r * 1.02]], 0.003, 6), wire));
  }
  head.add(part(ring(r * 0.08, 0.0035, Math.PI, 6, 16), wire, [r * 1.05, r * 0.08, 0], [0, 0, Math.PI / 2]));
}

export function dressHead(head: Group, r: number): void {
  muzzle(head, r);
  nose(head, r);
  browAndEars(head, r);
  mossCap(head, r);
  spectacles(head, r);
}
