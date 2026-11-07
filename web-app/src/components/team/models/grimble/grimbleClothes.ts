import { CapsuleGeometry, ConeGeometry, Group, Shape, type BufferGeometry, type Mesh } from "three";
import { CLOTH, DETAIL, FICTION } from "../../../residents/models/residentPalette";
import type { TeamRig } from "../kit/teamBody";
import { lacquer, metal, satin } from "../kit/teamMaterials";
import { ball, extrude, lathe, part, ring, rounded, tube, type Vec3 } from "../kit/teamShapes";
import { HIDE } from "./grimbleHead";

/*
 * Grimble's clothes (#146): a cream linen shirt with the sleeves rolled
 * up thick forearms, straining over a pot belly; a rust waistcoat with
 * lapels, brass buttons, a stitched patch and a watch chain; a twisted
 * rope belt with a coin pouch and a ring of bridge keys; olive trousers
 * with a patched knee and a ragged hem; big bare feet.
 */

export interface Build {
  torso: number;
  shoulder: number;
  waist: number;
  hip: number;
  legs: number;
}

const OLIVE = satin(CLOTH.OLIVE, { roughness: 0.82, doubleSided: true });
const STITCH = satin(DETAIL.EYE, { roughness: 0.9 });

/* The kit's torso profile, `pad` out from the body. */
function profile(b: Build, pad: number, from = -0.07, to = 1.02): [number, number][] {
  const t = b.torso;
  const base: [number, number][] = [[0.001, -0.07], [b.hip * 0.85, -0.06], [b.hip * 1.08, 0.03], [b.waist, t * 0.45], [b.shoulder * 0.86, t * 0.74], [b.shoulder * 0.84, t * 0.9], [b.shoulder * 0.55, t * 0.99], [0.06, t + 0.01]];
  return base.filter(([, y]) => y >= from && y <= t * to).map(([r, y]) => [r + pad, y]);
}

/* Swells a torso shell into a pot belly centred at `y`: out all round, most at the front. */
export function belly(geometry: BufferGeometry, y: number, height: number, amount: number): BufferGeometry {
  const position = geometry.attributes.position;
  for (let i = 0; i < position.count; i++) {
    const [px, py, pz] = [position.getX(i), position.getY(i), position.getZ(i)];
    const front = Math.max(0, px / Math.max(0.001, Math.hypot(px, pz)));
    const w = Math.exp(-(((py - y) / height) ** 2));
    const swell = 1 + amount * w * (0.35 + 0.65 * front ** 1.5);
    position.setX(i, px * swell + amount * 0.2 * w * front);
    position.setZ(i, pz * swell);
  }
  geometry.computeVertexNormals();
  return geometry;
}

function waistcoat(rig: TeamRig, b: Build): void {
  const t = b.torso;
  const cloth = satin(CLOTH.RUST, { roughness: 0.7, doubleSided: true });
  const coat = new Group();
  coat.scale.set(0.72, 1, 1);
  coat.add(part(belly(lathe(profile(b, 0.014, -0.02, 0.9), 72, Math.PI / 2 + 0.3, Math.PI * 2 - 0.6), t * 0.3, t * 0.28, 0.3), cloth));
  const lapel = new Shape();
  lapel.moveTo(0, 0);
  lapel.quadraticCurveTo(0.03, 0.09, 0.02, 0.19);
  lapel.lineTo(-0.035, 0.17);
  lapel.quadraticCurveTo(-0.01, 0.08, 0, 0);
  for (const side of [1, -1]) {
    rig.torso.add(part(extrude(lapel, 0.008, 0.003), cloth, [0.13, t * 0.55, side * 0.06], [side * 0.2, side * 0.45, -0.12], [1, 1, side]));
    for (let i = 0; i < 3; i++) rig.torso.add(part(ball(0.013, 16, 12), metal(FICTION.BRASS, 0.2), [0.2 - i * 0.025, t * (0.2 + i * 0.12), side * 0.07]));
  }
  rig.torso.add(coat);
  rig.torso.add(part(rounded(0.012, 0.075, 0.075, 0.01), satin(CLOTH.MUSTARD, { roughness: 0.8 }), [-0.165, t * 0.62, 0.05], [0, 0.15, 0.1]));
  for (let i = 0; i < 6; i++) rig.torso.add(part(rounded(0.004, 0.003, 0.012, 0.001), STITCH, [-0.172, t * 0.62 + 0.034 - (i % 3) * 0.034, 0.05 + (i < 3 ? 0.036 : -0.036)], [0, 0, 0.5]));
  rig.torso.add(part(tube([[0.205, t * 0.32, 0.07], [0.225, t * 0.2, 0.02], [0.2, t * 0.24, -0.06], [0.17, t * 0.32, -0.1]], 0.0035, 6), metal(FICTION.GOLD, 0.2)));
}

function ropeBelt(rig: TeamRig): void {
  const rope = lacquer(CLOTH.SAND, 0.7);
  for (const phase of [0, Math.PI]) {
    const points: Vec3[] = [];
    for (let i = 0; i <= 96; i++) {
      const a = (i / 96) * Math.PI * 2;
      const twist = Math.sin(a * 24 + phase) * 0.006;
      points.push([Math.cos(a) * (0.235 + twist) * 0.74, 0.02 + Math.cos(a * 24 + phase) * 0.006, Math.sin(a) * (0.235 + twist)]);
    }
    rig.torso.add(part(tube(points, 0.009, 6, 0.5), rope));
  }
  rig.torso.add(part(ball(0.024, 16, 12), rope, [0.17, 0.02, 0.06]), ...[0.05, 0.08].map((z) => part(tube([[0.17, 0.0, z], [0.18, -0.06, z + 0.01], [0.17, -0.1, z]], 0.007, 6), rope)));
  const pouch = new Group();
  pouch.position.set(0.08, -0.03, 0.2);
  pouch.add(part(ball(0.058, 24, 16), lacquer(FICTION.LEATHER, 0.55), [0, -0.04, 0], undefined, [0.85, 1, 0.75]));
  pouch.add(part(ring(0.022, 0.006, Math.PI * 2, 6, 20), lacquer(CLOTH.SAND, 0.6), [0, 0.01, 0]));
  pouch.add(part(ball(0.012, 10, 8), metal(FICTION.GOLD, 0.2), [0.04, -0.03, 0.01]));
  rig.torso.add(pouch);
  const keys = new Group();
  keys.position.set(0.0, -0.02, -0.22);
  keys.add(part(ring(0.035, 0.004, Math.PI * 2, 6, 28), metal(DETAIL.STEEL, 0.3), [0, -0.03, 0], [Math.PI / 2, 0, 0]));
  for (let i = 0; i < 3; i++) {
    const key = new Group();
    key.position.set(-0.02 + i * 0.02, -0.065, 0);
    key.rotation.z = (i - 1) * 0.3;
    key.add(part(ring(0.01, 0.003, Math.PI * 2, 6, 16), metal(DETAIL.STEEL, 0.3), [0, 0, 0], [Math.PI / 2, 0, 0]));
    key.add(part(rounded(0.005, 0.05, 0.005, 0.002), metal(DETAIL.STEEL, 0.3), [0, -0.035, 0]));
    key.add(part(rounded(0.005, 0.008, 0.014, 0.002), metal(DETAIL.STEEL, 0.3), [0, -0.055, 0.006]));
    keys.add(key);
  }
  rig.torso.add(keys);
}

function sleeves(rig: TeamRig): void {
  const linen = satin(CLOTH.CREAM, { roughness: 0.75 });
  for (const forearm of [rig.leftForearm, rig.rightForearm]) {
    forearm.add(part(ring(0.066, 0.024, Math.PI * 2, 10, 32), linen, [0, -0.015, 0]));
    forearm.add(part(lathe([[0.05, -0.29], [0.06, -0.24], [0.075, -0.14], [0.07, -0.06], [0.058, -0.01]], 32), HIDE));
  }
}

function trousers(rig: TeamRig, b: Build): void {
  const patch = satin(CLOTH.MUSTARD, { roughness: 0.85 });
  for (const [hip, shin, foot, patched] of [[rig.leftLeg, rig.leftShin, rig.leftFoot, true], [rig.rightLeg, rig.rightShin, rig.rightFoot, false]] as const) {
    hip.add(part(lathe([[0.11, -b.legs * 0.52], [0.122, -b.legs * 0.3], [0.124, -0.02], [0.1, 0.05]], 40), OLIVE));
    shin.add(part(lathe([[0.12, -b.legs * 0.4], [0.112, -b.legs * 0.2], [0.11, 0.02]], 40), OLIVE));
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2 + (i % 2) * 0.2;
      shin.add(part(new ConeGeometry(0.03, 0.045 + (i % 3) * 0.012, 8), OLIVE, [Math.cos(a) * 0.105, -b.legs * 0.4 - 0.02, Math.sin(a) * 0.105], [Math.PI, 0, 0]));
    }
    if (patched) {
      shin.add(part(rounded(0.01, 0.06, 0.06, 0.01), patch, [0.112, -0.03, 0.01], [0.25, 0, -0.05]));
      for (const [y, z] of [[0.0, 0.04], [-0.06, 0.035], [0.0, -0.02], [-0.06, -0.025]]) shin.add(part(rounded(0.003, 0.01, 0.0025, 0.001), STITCH, [0.118, y, z], [0.25, 0, 0]));
    }
    for (let i = 0; i < 4; i++) {
      const z = -0.045 + i * 0.03;
      foot.add(part(new CapsuleGeometry(0.02 - Math.abs(i - 1.5) * 0.002, 0.03, 6, 12), HIDE, [0.17, -0.04, z], [0, 0, Math.PI / 2]));
      foot.add(part(ball(0.011, 10, 8), satin(FICTION.BEARD, { roughness: 0.3 }), [0.198, -0.03, z], undefined, [0.6, 0.6, 1]));
    }
  }
}

/** Dresses Grimble and sculpts the pot belly into the shirt. */
export function dressGrimble(rig: TeamRig, b: Build): void {
  belly((rig.torso.children[0] as Mesh).geometry, b.torso * 0.3, b.torso * 0.28, 0.3);
  waistcoat(rig, b);
  ropeBelt(rig);
  sleeves(rig);
  trousers(rig, b);
  rig.torso.add(part(ring(0.07, 0.016, Math.PI * 2, 8, 32), satin(CLOTH.CREAM, { roughness: 0.75 }), [0, b.torso * 0.97, 0]));
}
