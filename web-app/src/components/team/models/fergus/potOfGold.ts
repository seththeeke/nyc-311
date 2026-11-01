import { CylinderGeometry, Group, type Mesh } from "three";
import { DETAIL, FICTION } from "../../../residents/models/residentPalette";
import { halo, lacquer, metal } from "../kit/teamMaterials";
import { ball, lathe, part, ring, rounded } from "../kit/teamShapes";

/*
 * Fergus's pot of gold (#146): a black iron cauldron on three stubby
 * feet, heaped over the rim with coins, a few spilled on the floor, and
 * glints that twinkle across the heap on stage.
 */

export interface PotOfGold {
  group: Group;
  update: (t: number) => void;
}

function coin(): Group {
  const group = new Group();
  const gold = metal(FICTION.GOLD, 0.22);
  group.add(part(new CylinderGeometry(0.024, 0.024, 0.006, 24), gold));
  group.add(part(ring(0.019, 0.0018, Math.PI * 2, 4, 24), metal(FICTION.BRASS, 0.3), [0, 0.003, 0]));
  return group;
}

export function buildPotOfGold(): PotOfGold {
  const group = new Group();
  const iron = lacquer(DETAIL.EYE, 0.45);
  group.add(part(lathe([[0.001, 0.035], [0.08, 0.035], [0.13, 0.07], [0.155, 0.13], [0.15, 0.19], [0.13, 0.225], [0.125, 0.23]], 48), iron));
  group.add(part(ring(0.135, 0.016, Math.PI * 2, 10, 48), iron, [0, 0.232, 0]));
  for (const side of [1, -1]) group.add(part(ring(0.035, 0.007, Math.PI, 6, 16), iron, [0, 0.2, side * 0.15], [Math.PI / 2, 0, 0]));
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    group.add(part(rounded(0.035, 0.05, 0.035, 0.012), iron, [Math.cos(a) * 0.09, 0.025, Math.sin(a) * 0.09]));
  }
  group.add(part(ball(0.13, 32, 16), metal(FICTION.GOLD, 0.3), [0, 0.235, 0], undefined, [1, 0.45, 1]));
  /* Coins on the heap, laid by a golden-angle spiral so they spread evenly, tilted to its slope. */
  for (let i = 0; i < 34; i++) {
    const a = i * 2.399;
    const d = Math.sqrt(i / 34) * 0.12;
    const y = 0.235 + 0.058 * Math.sqrt(Math.max(0, 1 - (d / 0.13) ** 2)) + 0.003;
    const piece = coin();
    piece.position.set(Math.cos(a) * d, y, Math.sin(a) * d);
    piece.rotation.set(Math.sin(a) * d * 4, a, Math.cos(a) * d * 4);
    group.add(piece);
  }
  for (const [x, z, tilt] of [[0.2, 0.05, 0.1], [0.17, -0.12, 0], [0.23, -0.02, 0.4], [-0.05, 0.19, 0], [0.12, 0.16, 0.2]]) {
    const piece = coin();
    piece.position.set(x, 0.003 + tilt * 0.02, z);
    piece.rotation.set(tilt, x * 10, 0);
    group.add(piece);
  }
  const glints: Mesh[] = [];
  for (let i = 0; i < 6; i++) {
    const a = i * 2.1;
    const glint = new Group();
    glint.position.set(Math.cos(a) * 0.07, 0.3 + (i % 2) * 0.01, Math.sin(a) * 0.07);
    for (const rotation of [0, Math.PI / 2]) {
      const ray = part(rounded(0.004, 0.06, 0.004, 0.0015), halo(FICTION.STAR, 0.9), [0, 0, 0], [rotation, 0, rotation]);
      glints.push(ray);
      glint.add(ray);
    }
    group.add(glint);
  }
  return {
    group,
    update(t) {
      glints.forEach((ray, i) => {
        const phase = Math.max(0, Math.sin(t * 2.2 + Math.floor(i / 2) * 1.7));
        ray.scale.setScalar(0.05 + phase ** 6);
      });
    },
  };
}
