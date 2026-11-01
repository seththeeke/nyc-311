import { Group, type Material } from "three";
import { CLOTH, DETAIL, FICTION, HAIR } from "../../../residents/models/residentPalette";
import type { TeamRig } from "../kit/teamBody";
import { lacquer, metal, satin } from "../kit/teamMaterials";
import { ball, lathe, lock, part, rounded, type Vec3 } from "../kit/teamShapes";

/*
 * Brogan's working clothes below the belt (#146): a curved leather apron
 * with stitched edges and a pocket holding the shift roster, baggy wool
 * trousers tucked into tall boots with fur cuffs and steel toe caps, and
 * a fur collar over the jerkin.
 */

const FUR = satin(HAIR.GREY, { roughness: 1 });

/* A ring of short fur tufts round a centre, pointing out and a little down. */
function furRing(parent: Group, centre: Vec3, radius: number, count: number, length: number, material: Material = FUR, squash = 1): void {
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 + (i % 2) * 0.1;
    const x = Math.cos(a) * radius * squash;
    const z = Math.sin(a) * radius;
    const start: Vec3 = [centre[0] + x * 0.8, centre[1] + 0.01, centre[2] + z * 0.8];
    const end: Vec3 = [centre[0] + x * (1 + length / radius), centre[1] - length * 0.5 - (i % 3) * 0.006, centre[2] + z * (1 + length / radius)];
    parent.add(part(lock([start, [(start[0] + end[0]) / 2, start[1] + 0.012, (start[2] + end[2]) / 2], end], 0.022, 0.004, 8), material));
  }
}

export function apron(rig: TeamRig): void {
  const leather = lacquer(FICTION.LEATHER, 0.5);
  const panel = new Group();
  panel.scale.set(0.78, 1, 1);
  const profile: [number, number][] = [[0.27, -0.4], [0.25, -0.25], [0.225, -0.1], [0.215, 0.03]];
  panel.add(part(lathe(profile, 24, Math.PI / 2 - 0.62, 1.24), satin(FICTION.LEATHER, { roughness: 0.55, doubleSided: true })));
  const thread = satin(CLOTH.SAND, { roughness: 0.9 });
  for (let i = 0; i < 14; i++) {
    const y = 0.0 - i * 0.028;
    const r = 0.218 + (-y / 0.4) * 0.05 + 0.004;
    for (const a of [Math.PI / 2 - 0.56, Math.PI / 2 + 0.56]) panel.add(part(ball(0.0045, 6, 4), thread, [r * Math.sin(a), y, r * Math.cos(a)]));
  }
  panel.add(part(lathe([[0.262, -0.3], [0.248, -0.2]], 16, Math.PI / 2 - 0.05, 0.36), satin(FICTION.LEATHER, { roughness: 0.4, doubleSided: true })));
  rig.torso.add(panel);
  const scroll = new Group();
  scroll.position.set(0.205, -0.17, 0.07);
  scroll.rotation.set(0.25, 0, 0.1);
  scroll.add(part(lathe([[0.016, -0.06], [0.016, 0.06]], 16), satin(CLOTH.CREAM, { roughness: 0.8 })));
  scroll.add(part(lathe([[0.018, 0.01], [0.018, 0.02]], 16), lacquer(DETAIL.EYE, 0.5)));
  rig.torso.add(scroll);
  rig.torso.add(part(rounded(0.03, 0.06, 0.05, 0.01), leather, [0.15, -0.02, -0.17]));
}

export function legs(rig: TeamRig, hipY: number): void {
  const wool = satin(CLOTH.SLATE, { roughness: 0.9 });
  const boot = lacquer(FICTION.LEATHER, 0.45);
  for (const leg of [rig.leftLeg, rig.rightLeg]) {
    leg.add(part(lathe([[0.085, 0.03], [0.115, -0.06], [0.12, -0.16], [0.115, -0.24], [0.095, -hipY + 0.2]], 28), wool));
    leg.add(part(lathe([[0.1, -hipY + 0.05], [0.096, -hipY + 0.12], [0.098, -hipY + 0.2]], 28), boot));
    furRing(leg, [0, -hipY + 0.2, 0], 0.1, 16, 0.035);
    leg.add(part(ball(0.068, 20, 12), metal(DETAIL.STEEL, 0.3), [0.12, -hipY + 0.048, 0], undefined, [1, 0.62, 1]));
    leg.add(part(rounded(0.02, 0.025, 0.11, 0.008), metal(FICTION.BRASS, 0.25), [0.085, -hipY + 0.12, 0]));
  }
}

export function furCollar(rig: TeamRig, top: number): void {
  const collar = new Group();
  collar.scale.set(0.8, 1, 1);
  furRing(collar, [0, top - 0.02, 0], 0.13, 22, 0.06, FUR);
  furRing(collar, [0, top - 0.05, 0], 0.19, 26, 0.05, satin(CLOTH.SAND, { roughness: 1 }));
  rig.torso.add(collar);
}
