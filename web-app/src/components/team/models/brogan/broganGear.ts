import { CylinderGeometry, Group, type MeshStandardMaterial } from "three";
import { DETAIL, FICTION, HAIR } from "../../../residents/models/residentPalette";
import { lamp, lacquer, metal, satin, glass } from "../kit/teamMaterials";
import { ball, lathe, part, ring, rounded, tube } from "../kit/teamShapes";

/*
 * Brogan's kit (#146): a riveted steel helm with a brass band and cheek
 * guards, a rune-banded war-hammer that doubles as his foreman's staff,
 * and a miner's lantern on the belt that flickers on stage.
 */

export function buildHelm(radius: number): Group {
  const helm = new Group();
  const steel = metal(DETAIL.STEEL, 0.38);
  const r = radius + 0.025;
  helm.add(part(lathe([[r * 1.02, 0.02], [r * 1.0, 0.08], [r * 0.93, 0.17], [r * 0.75, 0.25], [r * 0.45, 0.31], [0.04, 0.335], [0.001, 0.34]], 48), steel));
  helm.add(part(ring(r * 1.03, 0.022, Math.PI * 2, 10, 64), metal(FICTION.BRASS, 0.25), [0, 0.04, 0]));
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2;
    helm.add(part(ball(0.011, 10, 8), metal(FICTION.BRASS, 0.2), [Math.cos(a) * r * 1.06, 0.04, Math.sin(a) * r * 1.06]));
  }
  /* Six riveted ribs over the dome, a nasal guard and an engraved lower band. */
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
    const rib: [number, number, number][] = [0, 1, 2, 3, 4].map((k) => {
      const theta = Math.PI / 2 - (k / 4) * (Math.PI / 2 - 0.18);
      const rr = r * 1.015 * Math.sin(theta) + 0.006;
      return [Math.cos(a) * rr, 0.06 + Math.cos(theta) * 0.27, Math.sin(a) * rr];
    });
    helm.add(part(tube(rib, 0.009, 8), metal(FICTION.BRASS, 0.28)));
  }
  helm.add(part(ring(r * 1.0, 0.006, Math.PI * 2, 6, 64), metal(DETAIL.EYE, 0.5), [0, 0.1, 0]));
  helm.add(part(rounded(0.03, 0.17, 0.045, 0.012), steel, [r * 1.02, -0.02, 0], [0, 0, 0.12]));
  helm.add(part(ball(0.013, 10, 8), metal(FICTION.BRASS, 0.2), [r * 1.05, 0.05, 0]));
  for (const side of [1, -1]) {
    const guard = part(rounded(0.14, 0.2, 0.025, 0.012), steel, [0.03, -0.08, side * (r * 0.97)], [side * -0.12, side * 0.25, 0]);
    helm.add(guard);
    helm.add(part(ball(0.012, 10, 8), metal(FICTION.BRASS, 0.2), [0.07, -0.02, side * (r * 1.0)]));
  }
  return helm;
}

function runeBand(head: Group, y: number, material: MeshStandardMaterial): void {
  for (const x of [0.067, -0.067]) {
    head.add(part(rounded(0.008, 0.026, 0.2, 0.003), material, [x, y, 0]));
    for (let i = 0; i < 4; i++) head.add(part(rounded(0.006, 0.05, 0.008, 0.002), material, [x * 1.02, y, -0.075 + i * 0.05], [0.5 * (i % 2 ? 1 : -1), 0, 0]));
  }
}

export interface Hammer {
  group: Group;
  head: Group;
  /* The rune bands, which glow when the hammer is raised. */
  runes: MeshStandardMaterial;
}

/* How far the hammer's head stands above his fist, like the top of a staff. */
export const HAMMER_RISE = 0.3;

/** The hammer planted head-up at his side, gripped high on the haft: `drop` is grip to floor. */
export function buildHammer(drop: number): Hammer {
  const hammer = new Group();
  const wood = satin(HAIR.BROWN, { roughness: 0.7 });
  const top = HAMMER_RISE;
  const length = drop + top;
  hammer.add(part(new CylinderGeometry(0.021, 0.025, length, 20), wood, [0, top - length / 2, 0]));
  for (let i = 0; i < 6; i++) hammer.add(part(ring(0.027, 0.008, Math.PI * 2, 8, 24), satin(FICTION.LEATHER, { roughness: 0.8 }), [0, 0.06 - i * 0.022, 0]));
  hammer.add(part(lathe([[0.001, 0], [0.03, 0.005], [0.04, 0.03], [0.028, 0.06]], 20), metal(FICTION.BRASS, 0.25), [0, -drop, 0]));
  const head = new Group();
  head.position.set(0, top, 0);
  head.rotation.y = Math.PI / 2;
  const steel = metal(DETAIL.STEEL, 0.3);
  head.add(part(rounded(0.13, 0.12, 0.26, 0.022, 4), steel));
  for (const side of [1, -1]) {
    head.add(part(lathe([[0.072, 0], [0.082, 0.02], [0.082, 0.04], [0.068, 0.05], [0.001, 0.052]], 8), steel, [0, 0, side * 0.13], [side * Math.PI / 2, 0, Math.PI / 8]));
  }
  const runes = satin(FICTION.GOLD, { metalness: 0.9, roughness: 0.2, emissive: FICTION.EMBER, emissiveIntensity: 0 });
  runeBand(head, 0.0, runes);
  hammer.add(head);
  return { group: hammer, head, runes };
}

export interface Lantern {
  group: Group;
  flame: MeshStandardMaterial;
}

export function buildLantern(): Lantern {
  const group = new Group();
  const brass = metal(FICTION.BRASS, 0.3);
  group.add(part(lathe([[0.001, 0], [0.05, 0], [0.055, 0.015], [0.045, 0.025]], 24), brass));
  group.add(part(new CylinderGeometry(0.04, 0.04, 0.09, 20, 1, true), glass(FICTION.STAR, 0.3), [0, 0.07, 0]));
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    group.add(part(new CylinderGeometry(0.004, 0.004, 0.1, 6), brass, [Math.cos(a) * 0.043, 0.07, Math.sin(a) * 0.043]));
  }
  group.add(part(lathe([[0.05, 0.115], [0.035, 0.14], [0.012, 0.16], [0.001, 0.165]], 24), brass));
  group.add(part(ring(0.022, 0.004, Math.PI * 2, 6, 20), brass, [0, 0.18, 0], [Math.PI / 2, 0, 0]));
  const flame = lamp(FICTION.VISOR, 2.4);
  group.add(part(ball(0.016, 12, 10), flame, [0, 0.07, 0], undefined, [1, 1.7, 1]));
  group.add(part(rounded(0.04, 0.01, 0.04, 0.003), lacquer(DETAIL.EYE), [0, 0.04, 0]));
  return { group, flame };
}
