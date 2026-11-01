import { CylinderGeometry, Group, type Mesh, type MeshBasicMaterial } from "three";
import { DETAIL, FICTION } from "../../../residents/models/residentPalette";
import { halo, lamp, lacquer, metal } from "../kit/teamMaterials";
import { lathe, part, ring } from "../kit/teamShapes";

/*
 * The brass desk projector Penny is beamed from (#146): a turned base, a
 * glowing emitter ring, a faint cone of light and scanlines that climb
 * through her. `update` runs them and the flicker each frame.
 */

export interface Projector {
  group: Group;
  update: (t: number) => void;
}

export function buildProjector(height: number): Projector {
  const group = new Group();
  group.add(part(lathe([[0.001, 0], [0.42, 0], [0.43, 0.015], [0.4, 0.05], [0.33, 0.07], [0.3, 0.085], [0.001, 0.086]], 48), lacquer(DETAIL.EYE, 0.35)));
  group.add(part(ring(0.415, 0.012, Math.PI * 2, 8, 64), metal(FICTION.BRASS, 0.2), [0, 0.03, 0]));
  group.add(part(ring(0.31, 0.01, Math.PI * 2, 8, 64), lamp(FICTION.HOLO, 2.2), [0, 0.085, 0]));
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    group.add(part(new CylinderGeometry(0.012, 0.012, 0.01, 12), lamp(FICTION.HOLO, 1.4), [Math.cos(a) * 0.37, 0.058, Math.sin(a) * 0.37], [0, 0, 0]));
  }
  const coneMaterial = halo(FICTION.HOLO, 0.07);
  const cone = part(new CylinderGeometry(0.46, 0.31, height, 48, 1, true), coneMaterial, [0, 0.085 + height / 2, 0]);
  group.add(cone);
  const lines: Mesh[] = [];
  for (let i = 0; i < 5; i++) {
    const line = part(ring(0.4, 0.004, Math.PI * 2, 4, 64), halo(FICTION.HOLO, 0.35));
    lines.push(line);
    group.add(line);
  }
  return {
    group,
    update(t) {
      const flicker = 0.06 + Math.sin(t * 23) * 0.01 + (Math.sin(t * 3.7) > 0.97 ? 0.05 : 0);
      coneMaterial.opacity = flicker;
      lines.forEach((line, i) => {
        const phase = (t * 0.35 + i / lines.length) % 1;
        line.position.y = 0.09 + phase * height;
        line.scale.setScalar(1 + phase * 0.15);
        (line.material as MeshBasicMaterial).opacity = 0.35 * (1 - phase);
      });
    },
  };
}
