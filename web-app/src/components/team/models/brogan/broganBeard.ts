import { type Group, type Material } from "three";
import { FICTION, HAIR } from "../../../residents/models/residentPalette";
import { onHead } from "../kit/teamFace";
import { metal, satin } from "../kit/teamMaterials";
import { ball, lock, part, ring, type Vec3 } from "../kit/teamShapes";

/*
 * Brogan's beard and hair (#146), built from tapered locks rather than
 * blobs: a full beard falling in strands from the jaw, a moustache that
 * sweeps out and down, two plaits clasped in brass, tufted brows and
 * hair spilling from under the helm. All on the head, so it sways.
 */

const DARK = satin(HAIR.AUBURN, { roughness: 0.85 });
const LIGHT = satin(FICTION.GINGER, { roughness: 0.85 });

function strand(head: Group, points: Vec3[], start: number, end: number, material: Material): void {
  head.add(part(lock(points, start, end, 10), material));
}

/* A plait: tilted lobes alternating like strands crossing, brass rings and a tufted end. */
function braid(head: Group, top: Vec3, bottom: Vec3, side: number): void {
  const steps = 10;
  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1);
    const p: Vec3 = [top[0] + (bottom[0] - top[0]) * t, top[1] + (bottom[1] - top[1]) * t, top[2] + (bottom[2] - top[2]) * t];
    const lean = (i % 2 ? 1 : -1) * 0.55;
    head.add(part(ball(0.032 * (1 - t * 0.3), 18, 12), i % 2 ? DARK : LIGHT, p, [lean, 0, lean * 0.6], [0.95, 1.55, 0.85]));
  }
  for (const t of [0.3, 0.75]) {
    const p: Vec3 = [top[0] + (bottom[0] - top[0]) * t, top[1] + (bottom[1] - top[1]) * t, top[2] + (bottom[2] - top[2]) * t];
    head.add(part(ring(0.031, 0.01, Math.PI * 2, 10, 32), metal(FICTION.BRASS, 0.2), p, [0, 0, 0.1]));
  }
  for (let k = 0; k < 4; k++) {
    const spread = (k - 1.5) * 0.012;
    strand(head, [bottom, [bottom[0] + 0.01, bottom[1] - 0.05, bottom[2] + spread + side * 0.005], [bottom[0] + 0.02 + spread, bottom[1] - 0.09, bottom[2] + spread * 2]], 0.014, 0.004, LIGHT);
  }
}

function beard(head: Group, r: number): void {
  head.add(part(ball(r * 0.86, 32, 20), DARK, [r * 0.14, -r * 0.45, 0], undefined, [0.85, 0.72, 1.0]));
  for (let i = 0; i < 17; i++) {
    const t = i / 16;
    const across = (t - 0.5) * 2.3;
    const centre = 1 - Math.abs(t - 0.5) * 2;
    const start = onHead(r, -0.28 - centre * 0.22, across, -0.01);
    const length = r * (0.9 + centre * 1.15);
    const mid: Vec3 = [start[0] + 0.05 + centre * 0.05, start[1] - length * 0.45, start[2] * 0.85];
    const end: Vec3 = [start[0] + centre * 0.03 - 0.01, start[1] - length, start[2] * 0.55 + Math.sin(i * 2.3) * 0.02];
    strand(head, [start, mid, end], 0.055 + centre * 0.02, 0.01, i % 3 === 1 ? LIGHT : DARK);
  }
}

function moustache(head: Group, r: number): void {
  for (const side of [1, -1]) {
    for (let k = 0; k < 3; k++) {
      const start = onHead(r, -0.2 - k * 0.025, side * (0.03 + k * 0.03), 0.035);
      const out: Vec3 = [start[0] + 0.02, start[1] - 0.03 - k * 0.01, side * (0.12 + k * 0.012)];
      const end: Vec3 = [start[0] - 0.02, start[1] - 0.13 - k * 0.025, side * (0.2 + k * 0.01)];
      strand(head, [start, out, end], 0.034 - k * 0.004, 0.006, k === 1 ? DARK : LIGHT);
    }
  }
}

function brows(head: Group, r: number): void {
  for (const side of [1, -1]) {
    for (let k = 0; k < 5; k++) {
      const start = onHead(r, 0.2 + (k === 2 ? 0.015 : 0), side * (0.14 + k * 0.1), 0.012);
      const end = onHead(r, 0.23 + k * 0.008, side * (0.26 + k * 0.12), 0.075);
      strand(head, [start, [(start[0] + end[0]) / 2 + 0.01, (start[1] + end[1]) / 2, (start[2] + end[2]) / 2], end], 0.022, 0.004, LIGHT);
    }
  }
}

function hair(head: Group, r: number): void {
  head.add(part(ball(r * 1.02, 32, 20), DARK, [-r * 0.22, -r * 0.25, 0], undefined, [0.85, 1.05, 1.02]));
  for (let i = 0; i < 13; i++) {
    const across = Math.PI * 0.5 + (i / 12) * Math.PI;
    const start = onHead(r, 0.12, across, 0.02);
    const end: Vec3 = [start[0] * 1.15 - 0.03, -r * 1.05 - (i % 2) * 0.04, start[2] * 1.15];
    strand(head, [start, [start[0] * 1.12, -r * 0.4, start[2] * 1.12], end], 0.045, 0.012, i % 3 ? DARK : LIGHT);
  }
}

export function buildBeard(head: Group, radius: number): void {
  hair(head, radius);
  beard(head, radius);
  moustache(head, radius);
  brows(head, radius);
  for (const side of [1, -1]) braid(head, [radius * 0.55, -radius * 1.55, side * 0.075], [radius * 0.58, -radius * 2.6, side * 0.09], side);
}
