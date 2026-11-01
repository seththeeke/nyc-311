import { Group, Shape, SphereGeometry, type BufferGeometry } from "three";
import { FICTION } from "../../../residents/models/residentPalette";
import { metal, satin } from "../kit/teamMaterials";
import { extrude, lathe, part, ring, tube, type Vec3 } from "../kit/teamShapes";

/*
 * Celestine's robe (#146): a floor-length midnight robe that falls in
 * folds, gold trim, scattered embroidered stars and a crescent moon,
 * bell sleeves and a deep hood thrown back over a short mantle.
 */

const ROBE = satin(FICTION.ROBE, { roughness: 0.55, doubleSided: true });
const GOLD = metal(FICTION.GOLD, 0.3);
const STAR = metal(FICTION.STAR, 0.35);

export function starShape(outer: number, inner = outer * 0.45, points = 5): Shape {
  const shape = new Shape();
  for (let i = 0; i < points * 2; i++) {
    const a = (i / (points * 2)) * Math.PI * 2 + Math.PI / 2;
    const r = i % 2 ? inner : outer;
    if (i === 0) shape.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    else shape.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  shape.closePath();
  return shape;
}

export function crescentShape(radius: number): Shape {
  const shape = new Shape();
  shape.absarc(0, 0, radius, Math.PI * 0.25, Math.PI * 1.75, false);
  shape.absarc(radius * 0.45, 0, radius * 0.78, Math.PI * 1.62, Math.PI * 0.38, true);
  return shape;
}

/* Ripples the robe's radius round its circumference, deeper toward the hem, so it hangs in folds. */
function fold(geometry: BufferGeometry, top: number, bottom: number): BufferGeometry {
  const position = geometry.attributes.position;
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const z = position.getZ(i);
    const depth = Math.min(1, Math.max(0, (top - position.getY(i)) / (top - bottom)));
    const f = 1 + 0.07 * depth * Math.sin(9 * Math.atan2(x, z));
    position.setX(i, x * f);
    position.setZ(i, z * f);
  }
  geometry.computeVertexNormals();
  return geometry;
}

/** The skirt of the robe, from the waist (`top`) to the floor (`floor`), with its stars. */
export function buildSkirt(top: number, floor: number): Group {
  const skirt = new Group();
  skirt.scale.set(0.85, 1, 1);
  const profile: [number, number][] = [[0.3, floor], [0.27, floor + 0.15], [0.22, floor + 0.36], [0.17, top - 0.12], [0.135, top]];
  skirt.add(part(fold(lathe(profile, 72), top, floor), ROBE));
  skirt.add(part(fold(lathe([[0.302, floor + 0.005], [0.297, floor + 0.035]], 72), top, floor), GOLD));
  for (let i = 0; i < 16; i++) {
    const phi = i * 2.399 + 0.4;
    const y = top - 0.12 - (i / 15) * (top - floor - 0.2);
    const r = 0.17 + ((top - 0.12 - y) / (top - 0.12 - floor)) * 0.13 + 0.006;
    const star = part(extrude(starShape(0.018 - (i % 3) * 0.003), 0.003, 0.001), STAR, [r * Math.sin(phi), y, r * Math.cos(phi)], [0, phi - Math.PI / 2, i * 0.4]);
    skirt.add(star);
  }
  skirt.add(part(ring(0.138, 0.012, Math.PI * 2, 8, 48), GOLD, [0, top - 0.005, 0]));
  return skirt;
}

/** A bell sleeve flaring from the elbow past the wrist, trimmed in gold. */
export function buildSleeve(length: number): Group {
  const sleeve = new Group();
  const profile: [number, number][] = [[0.13, -length - 0.06], [0.11, -length * 0.7], [0.07, -length * 0.3], [0.058, 0.02]];
  sleeve.add(part(lathe(profile, 40), ROBE));
  sleeve.add(part(ring(0.13, 0.008, Math.PI * 2, 8, 40), GOLD, [0, -length - 0.06, 0]));
  return sleeve;
}

/** The hood thrown back, a gold-edged opening framing the face, over a short mantle. */
export function buildHood(radius: number): Group {
  const hood = new Group();
  const r = radius * 1.28;
  const gap = 0.95;
  hood.add(part(new SphereGeometry(r, 40, 24, Math.PI + gap, Math.PI * 2 - gap * 2, 0, Math.PI * 0.68), ROBE, [-radius * 0.12, radius * 0.05, 0]));
  const edge: Vec3[] = [];
  for (let i = 0; i <= 12; i++) {
    const theta = (i / 12) * Math.PI * 0.68;
    edge.push([-radius * 0.12 + r * Math.cos(gap) * Math.sin(theta), radius * 0.05 + r * Math.cos(theta), -r * Math.sin(gap) * Math.sin(theta)]);
  }
  const mirrored = edge.map(([x, y, z]) => [x, y, -z] as Vec3).reverse();
  hood.add(part(tube([...mirrored, ...edge.slice(1)], 0.008, 8), GOLD));
  return hood;
}

export function buildMantle(neck: number, shoulder: number): Group {
  const mantle = new Group();
  mantle.scale.set(0.8, 1, 1);
  mantle.add(part(fold(lathe([[shoulder * 1.15, neck - 0.2], [shoulder * 1.0, neck - 0.12], [shoulder * 0.6, neck - 0.03], [0.07, neck]], 60), neck, neck - 0.2), ROBE));
  mantle.add(part(ring(shoulder * 1.15, 0.008, Math.PI * 2, 8, 60), GOLD, [0, neck - 0.2, 0]));
  return mantle;
}

