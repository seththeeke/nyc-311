import { CylinderGeometry, Group, Shape } from "three";
import { CLOTH, DETAIL, FICTION, HERO } from "../../../residents/models/residentPalette";
import { lacquer, metal, satin } from "../kit/teamMaterials";
import { extrude, lathe, part, ring, rounded } from "../kit/teamShapes";

/*
 * Pip's tools (#146): an oversized adjustable wrench, a brass stopwatch
 * whose second hand really sweeps, and screwdrivers poking out of the
 * apron pocket.
 */

/** The wrench, hanging handle-up from the grip, jaw down. */
export function buildWrench(): Group {
  const wrench = new Group();
  const steel = metal(DETAIL.STEEL, 0.25);
  wrench.position.set(0, -0.02, 0);
  wrench.add(part(rounded(0.03, 0.26, 0.016, 0.008), steel, [0, -0.08, 0]));
  wrench.add(part(rounded(0.034, 0.11, 0.02, 0.008), lacquer(HERO.RED, 0.35), [0, 0.0, 0]));
  const jaw = new Shape();
  jaw.moveTo(-0.045, 0.0);
  jaw.lineTo(0.045, 0.0);
  jaw.lineTo(0.05, -0.06);
  jaw.lineTo(0.022, -0.075);
  jaw.lineTo(0.022, -0.035);
  jaw.lineTo(-0.022, -0.035);
  jaw.lineTo(-0.022, -0.075);
  jaw.lineTo(-0.05, -0.06);
  jaw.closePath();
  const head = part(extrude(jaw, 0.022, 0.004), steel, [0, -0.205, -0.011], [0, -Math.PI / 2, 0]);
  wrench.add(head);
  const worm = part(new CylinderGeometry(0.011, 0.011, 0.04, 16), metal(FICTION.BRASS, 0.3), [0, -0.225, 0], [0, 0, Math.PI / 2]);
  wrench.add(worm);
  for (let i = 0; i < 5; i++) wrench.add(part(ring(0.012, 0.002, Math.PI * 2, 4, 16), metal(FICTION.BRASS, 0.3), [-0.016 + i * 0.008, -0.225, 0], [0, 0, Math.PI / 2]));
  return wrench;
}

export interface Stopwatch {
  group: Group;
  hand: Group;
}

/** The stopwatch, face toward +x; `hand` turns about x. */
export function buildStopwatch(): Stopwatch {
  const group = new Group();
  const brass = metal(FICTION.BRASS, 0.2);
  const face = new Group();
  face.rotation.z = -Math.PI / 2;
  face.add(part(lathe([[0.001, -0.012], [0.045, -0.012], [0.05, 0.0], [0.046, 0.01], [0.04, 0.012]], 40), brass));
  face.add(part(new CylinderGeometry(0.039, 0.039, 0.004, 40), satin(CLOTH.CREAM, { roughness: 0.4 }), [0, 0.011, 0]));
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    face.add(part(rounded(0.002, 0.002, i % 3 ? 0.006 : 0.011, 0.0005), satin(DETAIL.EYE), [Math.cos(a) * 0.031, 0.014, Math.sin(a) * 0.031], [0, -a, 0]));
  }
  group.add(face);
  group.add(part(new CylinderGeometry(0.008, 0.008, 0.016, 16), brass, [0, 0.055, 0]));
  group.add(part(ring(0.012, 0.003, Math.PI * 2, 6, 20), brass, [0, 0.07, 0], [Math.PI / 2, 0, 0]));
  const hand = new Group();
  hand.position.set(0.016, 0, 0);
  hand.add(part(rounded(0.002, 0.032, 0.003, 0.001), lacquer(HERO.RED, 0.3), [0, 0.012, 0]));
  hand.add(part(new CylinderGeometry(0.004, 0.004, 0.003, 12), lacquer(HERO.RED, 0.3), [0, 0, 0], [0, 0, Math.PI / 2]));
  group.add(hand);
  return { group, hand };
}

/** Two screwdrivers and a pencil standing in a pocket. */
export function pocketTools(): Group {
  const tools = new Group();
  for (const [z, color, height] of [[-0.03, HERO.RED, 0.06], [0.0, CLOTH.MUSTARD, 0.075], [0.03, FICTION.SIDEKICK, 0.055]] as const) {
    tools.add(part(new CylinderGeometry(0.009, 0.01, 0.045, 12), lacquer(color, 0.4), [0, height, z]));
    tools.add(part(new CylinderGeometry(0.003, 0.003, 0.05, 8), metal(DETAIL.STEEL, 0.2), [0, height - 0.04, z]));
  }
  return tools;
}
