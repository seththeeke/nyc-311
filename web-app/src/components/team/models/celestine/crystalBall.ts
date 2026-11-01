import { Group, type Mesh, type MeshBasicMaterial, PointLight } from "three";
import { FICTION } from "../../../residents/models/residentPalette";
import { glass, halo, lamp, metal } from "../kit/teamMaterials";
import { ball, part, ring } from "../kit/teamShapes";

/*
 * Celestine's crystal ball (#146): clear glass over a slowly turning
 * nebula, a bright core and a real light inside, so the orb lights her
 * face and hands. Sparks orbit it on stage.
 */

export interface CrystalBall {
  group: Group;
  /** One frame at `t` seconds; `power` 0-1 brightens the orb and flings its sparks wider, for a vision. */
  update: (t: number, power?: number) => void;
}

export function buildCrystalBall(radius = 0.1): CrystalBall {
  const group = new Group();
  const nebula = new Group();
  const swirls: Mesh[] = [];
  for (let i = 0; i < 5; i++) {
    const wisp = part(ball(radius * (0.42 + i * 0.08), 20, 14), halo(i % 2 ? FICTION.CRYSTAL : FICTION.HOLO, 0.16), [Math.cos(i * 1.3) * radius * 0.25, Math.sin(i * 2.1) * radius * 0.2, Math.sin(i * 1.3) * radius * 0.25], [i, i * 0.5, 0], [1.3, 0.55, 0.9]);
    swirls.push(wisp);
    nebula.add(wisp);
  }
  group.add(nebula);
  const core = lamp(FICTION.CRYSTAL, 2.5);
  group.add(part(ball(radius * 0.18, 16, 12), core));
  group.add(part(ball(radius, 48, 32), glass(FICTION.CRYSTAL, 0.28)));
  group.add(part(ball(radius * 1.08, 32, 20), halo(FICTION.CRYSTAL, 0.08)));
  const light = new PointLight(FICTION.CRYSTAL, 1.6, 1.4, 1.6);
  group.add(light);
  /* A brass ring the orb rests in, on her palm. */
  group.add(part(ring(radius * 0.62, radius * 0.07, Math.PI * 2, 10, 40), metal(FICTION.BRASS, 0.2), [0, -radius * 0.8, 0]));
  const sparks: Mesh[] = [];
  for (let i = 0; i < 7; i++) {
    const spark = part(ball(0.006, 8, 6), halo(FICTION.STAR, 0.9));
    sparks.push(spark);
    group.add(spark);
  }
  return {
    group,
    update(t, power = 0) {
      nebula.rotation.set(t * 0.3, t * 0.55, Math.sin(t * 0.4) * 0.4 + power * 1.5);
      const pulse = 0.5 + 0.5 * Math.sin(t * (1.8 + power * 4));
      core.emissiveIntensity = 2 + pulse * 1.2 + power * 4;
      light.intensity = 1.2 + pulse * 0.8 + power * 2.5;
      swirls.forEach((wisp, i) => {
        (wisp.material as MeshBasicMaterial).opacity = 0.12 + 0.08 * Math.sin(t * 1.3 + i) + power * 0.14;
      });
      sparks.forEach((spark, i) => {
        const a = t * (0.8 + i * 0.15) * (1 + power) + i * 0.9;
        const r = radius * (1.35 + (i % 3) * 0.18 + power * 0.9);
        spark.position.set(Math.cos(a) * r, Math.sin(a * 1.7 + i) * radius * 0.6, Math.sin(a) * r);
      });
    },
  };
}
