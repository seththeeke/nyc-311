import { Group, Shape } from "three";
import { CLOTH, DETAIL, FICTION } from "../../../residents/models/residentPalette";
import type { TeamRig } from "../kit/teamBody";
import { lacquer, metal, satin } from "../kit/teamMaterials";
import { extrude, lathe, part, ring, rounded, wrapOnSphere } from "../kit/teamShapes";

/*
 * Kid Kestrel's costume (#146): a domino mask bent round the face, a
 * kestrel emblem on a cream roundel, a gold utility belt with pouches,
 * flared gloves and boots, and a short two-tone cape on gold clasps.
 * Her own colours: sky blue and ember orange.
 */

const EMBER = lacquer(FICTION.EMBER, 0.4);

function maskShape(): Shape {
  const outline: [number, number][] = [[-0.17, 0.085], [-0.11, 0.07], [-0.04, 0.062], [0, 0.05], [0.04, 0.062], [0.11, 0.07], [0.17, 0.085], [0.14, 0.01], [0.1, -0.035], [0.04, -0.03], [0, -0.012], [-0.04, -0.03], [-0.1, -0.035], [-0.14, 0.01]];
  const shape = new Shape();
  outline.forEach(([x, y], i) => (i === 0 ? shape.moveTo(x, y) : shape.lineTo(x, y)));
  shape.closePath();
  for (const x of [-0.083, 0.083]) {
    const hole = new Shape();
    hole.absellipse(x, 0.018, 0.05, 0.04, 0, Math.PI * 2, true, 0);
    shape.holes.push(hole);
  }
  return shape;
}

export function mask(head: Group, radius: number): void {
  const geometry = wrapOnSphere(extrude(maskShape(), 0.006, 0.002), radius + 0.006);
  head.add(part(geometry, satin(DETAIL.EYE, { roughness: 0.35 })));
}

function kestrelShape(): Shape {
  const bird = new Shape();
  const points: [number, number][] = [[0, 0.04], [0.015, 0.012], [0.06, 0.03], [0.045, 0.0], [0.012, -0.012], [0.008, -0.045], [0, -0.03], [-0.008, -0.045], [-0.012, -0.012], [-0.045, 0.0], [-0.06, 0.03], [-0.015, 0.012]];
  points.forEach(([x, y], i) => (i === 0 ? bird.moveTo(x, y) : bird.lineTo(x, y)));
  bird.closePath();
  return bird;
}

export function emblem(rig: TeamRig, torso: number): void {
  const badge = new Group();
  badge.position.set(0.1, torso * 0.68, 0);
  badge.rotation.z = -0.12;
  const disc = new Shape();
  disc.absarc(0, 0, 0.062, 0, Math.PI * 2, false);
  badge.add(part(extrude(disc, 0.006, 0.002), lacquer(CLOTH.CREAM, 0.4)));
  badge.add(part(extrude(kestrelShape(), 0.006, 0.002), EMBER, [0.007, 0, 0]));
  badge.add(part(ring(0.062, 0.004, Math.PI * 2, 6, 40), metal(FICTION.GOLD, 0.2), [0.006, 0, 0], [0, 0, Math.PI / 2]));
  rig.torso.add(badge);
}

export function belt(rig: TeamRig): void {
  const band = new Group();
  band.scale.set(0.76, 1, 1);
  band.add(part(lathe([[0.135, -0.005], [0.14, 0.02], [0.135, 0.045]], 48), metal(FICTION.GOLD, 0.3)));
  for (const a of [0.75, 1.5, 2.25, -0.75, -1.5, -2.25]) band.add(part(rounded(0.04, 0.05, 0.035, 0.01), lacquer(FICTION.SIDEKICK, 0.5), [0.145 * Math.cos(a), 0.015, 0.145 * Math.sin(a)], [0, -a, 0]));
  band.add(part(rounded(0.022, 0.05, 0.05, 0.012), EMBER, [0.142, 0.02, 0]));
  rig.torso.add(band);
}

export function gloves(rig: TeamRig, hipY: number): void {
  for (const forearm of [rig.leftForearm, rig.rightForearm]) {
    forearm.add(part(lathe([[0.065, -0.235], [0.05, -0.17], [0.042, -0.12]], 28), EMBER));
  }
  for (const leg of [rig.leftLeg, rig.rightLeg]) {
    leg.add(part(lathe([[0.065, -hipY + 0.06], [0.07, -hipY + 0.2], [0.085, -hipY + 0.27], [0.08, -hipY + 0.28]], 28), EMBER));
    leg.add(part(rounded(0.012, 0.3, 0.012, 0.005), satin(FICTION.EMBER), [0, -0.15, 0.06]));
  }
}

export interface Cape {
  group: Group;
}

/** A short cape from the shoulders to the hip, ember outside and blue inside, pinned with gold clasps. */
export function cape(rig: TeamRig, torso: number): Cape {
  const group = new Group();
  group.position.set(0, torso * 0.95, 0);
  const span = Math.PI * 1.15;
  const start = Math.PI * 1.5 - span / 2;
  const profile: [number, number][] = [[0.29, -0.55], [0.26, -0.35], [0.21, -0.15], [0.15, 0.0], [0.12, 0.03]];
  group.add(part(lathe(profile, 48, start, span), satin(FICTION.EMBER, { roughness: 0.5 })));
  group.add(part(lathe(profile.map(([r, y]) => [r - 0.008, y]), 48, start, span), satin(FICTION.SIDEKICK, { roughness: 0.6, doubleSided: true })));
  for (const side of [1, -1]) group.add(part(lathe([[0.022, -0.004], [0.026, 0.0], [0.02, 0.008]], 24), metal(FICTION.GOLD, 0.2), [0.06, 0.0, side * 0.12], [0, 0, -Math.PI / 2]));
  rig.torso.add(group);
  return { group };
}
