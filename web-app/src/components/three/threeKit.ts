import {
  BoxGeometry,
  type BufferGeometry,
  Color,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  type Object3D,
  SphereGeometry,
  AdditiveBlending,
} from "three";

/*
 * Small helpers every procedural model shares: flat-shaded low-poly
 * materials, one-call mesh placement, a deterministic particle pool and
 * recursive disposal. Units are metres; models face +x with y up.
 */

export interface MaterialOptions {
  emissive?: string;
  emissiveIntensity?: number;
  roughness?: number;
  metalness?: number;
  transparent?: boolean;
  opacity?: number;
}

export function solid(color: string, options: MaterialOptions = {}): MeshStandardMaterial {
  return new MeshStandardMaterial({
    color: new Color(color),
    flatShading: true,
    roughness: options.roughness ?? 0.65,
    metalness: options.metalness ?? 0.05,
    emissive: new Color(options.emissive ?? "#000000"),
    emissiveIntensity: options.emissiveIntensity ?? 1,
    transparent: options.transparent ?? false,
    opacity: options.opacity ?? 1,
  });
}

/** Unlit, additive — for glows, beams and light cones that should read as light, not surface. */
export function glow(color: string, opacity: number): MeshBasicMaterial {
  return new MeshBasicMaterial({
    color: new Color(color),
    transparent: true,
    opacity,
    blending: AdditiveBlending,
    depthWrite: false,
  });
}

export function place<T extends Object3D>(object: T, x: number, y: number, z: number): T {
  object.position.set(x, y, z);
  return object;
}

export function box(
  width: number,
  height: number,
  depth: number,
  material: MeshStandardMaterial | MeshBasicMaterial,
  at: [number, number, number] = [0, 0, 0]
): Mesh {
  return place(new Mesh(new BoxGeometry(width, height, depth), material), ...at);
}

export function mesh(geometry: BufferGeometry, material: MeshStandardMaterial | MeshBasicMaterial, at: [number, number, number] = [0, 0, 0]): Mesh {
  return place(new Mesh(geometry, material), ...at);
}

export interface PuffPoolOptions {
  count: number;
  color: string;
  /** Radius at birth; puffs grow to `growTo` times this. */
  size: number;
  growTo: number;
  /** Metres travelled over one lifetime. */
  rise: [number, number, number];
  lifetimeSeconds: number;
  maxOpacity: number;
  additive?: boolean;
}

export interface PuffPool {
  group: Group;
  /** `intensity` 0 hides the pool; puffs are staggered evenly through their lifetime, so no randomness is needed. */
  update(timeSeconds: number, intensity: number): void;
}

export function createPuffPool(options: PuffPoolOptions): PuffPool {
  const group = new Group();
  const geometry = new SphereGeometry(options.size, 6, 5);
  const puffs = Array.from({ length: options.count }, () => {
    const material = options.additive ? glow(options.color, 0) : solid(options.color, { transparent: true, opacity: 0 });
    material.depthWrite = false;
    const puff = new Mesh(geometry, material);
    group.add(puff);
    return { puff, material };
  });
  return {
    group,
    update(timeSeconds, intensity) {
      group.visible = intensity > 0;
      puffs.forEach(({ puff, material }, i) => {
        const life = (timeSeconds / options.lifetimeSeconds + i / options.count) % 1;
        const [rx, ry, rz] = options.rise;
        /* A little sideways wobble per puff so the column doesn't look like beads on a wire. */
        const wobble = Math.sin((i + 1) * 1.7 + timeSeconds * 2) * 0.15 * life;
        puff.position.set(rx * life + wobble, ry * life, rz * life - wobble);
        puff.scale.setScalar(1 + (options.growTo - 1) * life);
        material.opacity = options.maxOpacity * intensity * (1 - life) * Math.min(1, life * 6);
      });
    },
  };
}

interface Disposable {
  dispose(): void;
}

function disposeMaterial(material: Disposable | Disposable[]): void {
  if (Array.isArray(material)) material.forEach((m) => m.dispose());
  else material.dispose();
}

/** Frees every geometry and material under `root`; shared ones are safe to dispose twice. */
export function disposeObject(root: Object3D): void {
  root.traverse((node) => {
    if (node instanceof Mesh) {
      node.geometry.dispose();
      disposeMaterial(node.material as Disposable | Disposable[]);
    }
  });
}

/** Moves `current` toward `target` by the shortest way round the circle. */
export function approachAngle(current: number, target: number, factor: number): number {
  const delta = Math.atan2(Math.sin(target - current), Math.cos(target - current));
  return current + delta * Math.min(1, Math.max(0, factor));
}
