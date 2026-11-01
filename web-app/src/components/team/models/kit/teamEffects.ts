import { Group, type MeshBasicMaterial } from "three";
import { halo } from "./teamMaterials";
import { ball, part, ring } from "./teamShapes";

/*
 * One-shot effects for the executives' performances (#146): spark bursts
 * and shockwave rings. Each is driven by its progress, 0 to 1, and hides
 * outside that. Marked `fx` so the stage camera frames the figure, not
 * the sparks.
 */

export interface Effect {
  group: Group;
  /** Shows the effect `k` of the way through; hidden when `k` is outside 0-1. */
  update: (k: number) => void;
}

export interface BurstStyle {
  count?: number;
  /* How far the sparks fly out, and up. */
  reach?: number;
  rise?: number;
  /* How far they fall back by the end. */
  fall?: number;
  size?: number;
  /* 0 throws all round; 1 throws only up. */
  upward?: number;
}

/** Sparks thrown out from the group's origin in a golden-angle spray, flying, falling and fading. */
export function sparkBurst(color: string, style: BurstStyle = {}): Effect {
  const group = new Group();
  group.userData.fx = true;
  const material = halo(color, 1);
  const count = style.count ?? 18;
  const directions: [number, number, number][] = [];
  for (let i = 0; i < count; i++) {
    const a = i * 2.39996;
    const up = (style.upward ?? 0.5) + (1 - (style.upward ?? 0.5)) * ((i * 0.618) % 1);
    const out = Math.sqrt(Math.max(0, 1 - up * up)) + 0.3;
    directions.push([Math.cos(a) * out, up, Math.sin(a) * out]);
    group.add(part(ball((style.size ?? 0.012) * (0.6 + ((i * 0.37) % 0.8)), 8, 6), material));
  }
  return {
    group,
    update(k) {
      group.visible = k > 0 && k < 1;
      if (!group.visible) return;
      const reach = style.reach ?? 0.4;
      const fly = 1 - (1 - k) ** 2;
      group.children.forEach((spark, i) => {
        const [x, y, z] = directions[i];
        const speed = 0.7 + ((i * 0.53) % 0.6);
        spark.position.set(x * reach * fly * speed, y * (style.rise ?? reach) * fly * speed - (style.fall ?? 0.2) * k * k, z * reach * fly * speed);
        spark.scale.setScalar(1 - k * 0.6);
      });
      material.opacity = (1 - k) ** 1.5;
    },
  };
}

/** A ring of light spreading across the floor from the group's origin. */
export function shockwave(color: string, radius = 0.6): Effect {
  const group = new Group();
  group.userData.fx = true;
  const rings = [halo(color, 0.8), halo(color, 0.35)];
  group.add(part(ring(1, 0.035, Math.PI * 2, 6, 64), rings[0]));
  group.add(part(ring(0.85, 0.09, Math.PI * 2, 6, 64), rings[1], [0, 0.002, 0]));
  return {
    group,
    update(k) {
      group.visible = k > 0 && k < 1;
      if (!group.visible) return;
      const spread = radius * (0.12 + 0.88 * (1 - (1 - k) ** 2.5));
      group.scale.set(spread, 1, spread);
      rings.forEach((material: MeshBasicMaterial, i) => {
        material.opacity = (1 - k) ** 2 * (i ? 0.35 : 0.8);
      });
    },
  };
}

/** Soft puffs rolling out low from the group's origin: dust from a landing or a strike. */
export function dustPuff(color: string, radius = 0.35): Effect {
  const group = new Group();
  group.userData.fx = true;
  const material = halo(color, 0.3);
  for (let i = 0; i < 9; i++) group.add(part(ball(0.06, 12, 8), material));
  return {
    group,
    update(k) {
      group.visible = k > 0 && k < 1;
      if (!group.visible) return;
      const out = radius * (1 - (1 - k) ** 2);
      group.children.forEach((puff, i) => {
        const a = (i / 9) * Math.PI * 2 + 0.3;
        puff.position.set(Math.cos(a) * out, 0.03 + k * 0.08 * (1 + (i % 3) * 0.5), Math.sin(a) * out);
        puff.scale.setScalar(0.5 + k * 1.3);
      });
      material.opacity = 0.32 * (1 - k) ** 1.5;
    },
  };
}
