import { CylinderGeometry, Group, type MeshStandardMaterial } from "three";
import { CLOTH, DETAIL, FICTION, HERO } from "../../../residents/models/residentPalette";
import { lacquer, lamp, metal } from "../kit/teamMaterials";
import { ball, lathe, part, ring, rounded } from "../kit/teamShapes";

/*
 * Rex's helmet (#146), carried under his arm: an olive atomic-age dome
 * with a gunmetal face plate, one wide amber visor slit, a breathing
 * grille, brass side vents, rivets and a stub antenna. Faces +x.
 */

export interface Helmet {
  group: Group;
  visor: MeshStandardMaterial;
}

export function buildHelmet(): Helmet {
  const group = new Group();
  const paint = lacquer(CLOTH.OLIVE, 0.45);
  const plate = metal(FICTION.GUNMETAL, 0.38);
  const brass = metal(FICTION.BRASS, 0.25);
  group.add(part(lathe([[0.13, -0.13], [0.15, -0.1], [0.165, -0.02], [0.16, 0.06], [0.13, 0.13], [0.07, 0.17], [0.001, 0.18]], 48), paint));
  group.add(part(ring(0.135, 0.016, Math.PI * 2, 10, 48), plate, [0, -0.13, 0]));
  /* Face plate, the visor slit across it, and the grille under it. */
  group.add(part(lathe([[0.168, -0.11], [0.172, -0.02], [0.165, 0.05]], 32, Math.PI / 2 - 0.85, 1.7), plate));
  const visor = lamp(FICTION.VISOR, 2.2);
  group.add(part(lathe([[0.176, 0.0], [0.177, 0.028]], 32, Math.PI / 2 - 0.7, 1.4), visor));
  group.add(part(lathe([[0.18, -0.004], [0.181, 0.0]], 32, Math.PI / 2 - 0.75, 1.5), brass));
  group.add(part(lathe([[0.181, 0.03], [0.182, 0.034]], 32, Math.PI / 2 - 0.75, 1.5), brass));
  for (let i = 0; i < 5; i++) group.add(part(rounded(0.012, 0.007, 0.09 - Math.abs(i - 2) * 0.012, 0.003), metal(DETAIL.EYE, 0.4), [0.17, -0.045 - i * 0.014, 0]));
  for (const side of [1, -1]) {
    const vent = new Group();
    vent.position.set(0, -0.02, side * 0.165);
    vent.rotation.x = side * Math.PI / 2;
    vent.add(part(new CylinderGeometry(0.045, 0.05, 0.03, 32), brass));
    for (let i = 0; i < 4; i++) vent.add(part(ring(0.012 + i * 0.009, 0.0025, Math.PI * 2, 4, 24), metal(DETAIL.EYE, 0.4), [0, 0.016, 0]));
    group.add(vent);
  }
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    group.add(part(ball(0.006, 8, 6), brass, [Math.cos(a) * 0.154, -0.1, Math.sin(a) * 0.154]));
  }
  /* A stencilled stripe over the crown and the stub antenna. */
  group.add(part(lathe([[0.152, 0.07], [0.12, 0.125]], 48, -0.12, 0.24), lacquer(CLOTH.MUSTARD, 0.4)));
  group.add(part(new CylinderGeometry(0.004, 0.006, 0.09, 8), plate, [-0.08, 0.17, -0.05], [0.3, 0, 0.3]));
  group.add(part(ball(0.009, 10, 8), lamp(HERO.RED, 1.5), [-0.093, 0.21, -0.064]));
  return { group, visor };
}
