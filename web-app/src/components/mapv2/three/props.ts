import { CircleGeometry, ConeGeometry, CylinderGeometry, DodecahedronGeometry, Group, type Mesh, SphereGeometry } from "three";
import { box, glow, mesh, solid } from "../../three/threeKit";

/* The street furniture and work-zone kit, all procedural. Each builder returns a fresh Group at the origin. */

export function buildCone(): Group {
  const cone = new Group();
  cone.add(box(0.42, 0.04, 0.42, solid("#1d1f24"), [0, 0.02, 0]));
  cone.add(mesh(new ConeGeometry(0.17, 0.7, 10), solid("#ff6a13", { emissive: "#ff6a13", emissiveIntensity: 0.15 }), [0, 0.39, 0]));
  cone.add(mesh(new CylinderGeometry(0.085, 0.11, 0.12, 10), solid("#f4f6f8", { emissive: "#ffffff", emissiveIntensity: 0.5 }), [0, 0.44, 0]));
  return cone;
}

export function buildBarrier(): Group {
  const barrier = new Group();
  for (const z of [-0.8, 0.8]) barrier.add(box(0.08, 1, 0.08, solid("#d9dde3"), [0, 0.5, z]));
  for (let i = 0; i < 4; i += 1) {
    barrier.add(box(0.06, 0.2, 0.32, solid(i % 2 ? "#f4f6f8" : "#ff6a13", { emissive: "#ff6a13", emissiveIntensity: i % 2 ? 0 : 0.2 }), [0, 0.8, -0.48 + i * 0.32]));
  }
  return barrier;
}

export interface RollerRig {
  root: Group;
  drums: Mesh[];
}

/** A small tandem asphalt roller; spin `drums` about z to roll it. */
export function buildRoller(): RollerRig {
  const root = new Group();
  const drumGeometry = new CylinderGeometry(0.45, 0.45, 1.3, 14).rotateX(Math.PI / 2);
  const drums = [-0.85, 0.85].map((x) => {
    const drum = mesh(drumGeometry, solid("#7d8691", { metalness: 0.7, roughness: 0.35 }), [x, 0.45, 0]);
    root.add(drum);
    return drum;
  });
  root.add(box(1.7, 0.45, 1.1, solid("#f2b705"), [0, 1.05, 0]));
  root.add(box(0.7, 0.6, 0.9, solid("#f2b705"), [-0.2, 1.55, 0]));
  root.add(box(0.06, 0.9, 0.06, solid("#2a2d33"), [0.25, 2.0, 0.4]));
  root.add(box(0.06, 0.9, 0.06, solid("#2a2d33"), [0.25, 2.0, -0.4]));
  root.add(box(0.9, 0.06, 1.0, solid("#2a2d33"), [0, 2.45, 0]));
  root.add(mesh(new SphereGeometry(0.09, 8, 6), glow("#ffb020", 0.9), [0, 2.55, 0]));
  return { root, drums };
}

/** A ragged dark hole, sunk just below the road so it reads as depth. */
export function buildPothole(): Group {
  const hole = new Group();
  hole.add(mesh(new CircleGeometry(1.15, 9).rotateX(-Math.PI / 2), solid("#121417", { roughness: 1 }), [0, 0.012, 0]));
  hole.add(mesh(new CircleGeometry(0.7, 7).rotateX(-Math.PI / 2), solid("#07080a", { roughness: 1 }), [0.15, 0.014, -0.1]));
  return hole;
}

/** The fresh asphalt patch; grows from the cut outline as it's poured. */
export function buildPatch(): Mesh {
  return box(2.6, 0.06, 2.0, solid("#1b1c1f", { emissive: "#ff5a1a", emissiveIntensity: 0, roughness: 0.95 }), [0, 0.03, 0]);
}

export function buildDebris(seed: number): Mesh {
  const chunk = mesh(new DodecahedronGeometry(0.12 + (seed % 3) * 0.04, 0), solid("#3a3d42", { roughness: 1 }));
  chunk.rotation.set(seed * 0.7, seed * 1.3, seed * 0.4);
  return chunk;
}

export function buildStreetLamp(): Group {
  const lamp = new Group();
  lamp.add(mesh(new CylinderGeometry(0.07, 0.1, 5.5, 6), solid("#3b4250", { metalness: 0.5 }), [0, 2.75, 0]));
  lamp.add(box(1.2, 0.08, 0.08, solid("#3b4250"), [0.55, 5.45, 0]));
  lamp.add(box(0.5, 0.12, 0.28, solid("#fff3d1", { emissive: "#ffd98a", emissiveIntensity: 1.4 }), [1.05, 5.36, 0]));
  return lamp;
}

export function buildTree(scale: number): Group {
  const tree = new Group();
  tree.add(mesh(new CylinderGeometry(0.12, 0.16, 1.6, 6), solid("#5b4130"), [0, 0.8, 0]));
  tree.add(mesh(new DodecahedronGeometry(1.05, 0), solid("#3f8f5a"), [0, 2.3, 0]));
  tree.add(mesh(new DodecahedronGeometry(0.75, 0), solid("#4fa96b"), [0.35, 2.9, 0.2]));
  tree.scale.setScalar(scale);
  return tree;
}

export function buildHydrant(): Group {
  const hydrant = new Group();
  hydrant.add(mesh(new CylinderGeometry(0.16, 0.2, 0.7, 8), solid("#d7262e"), [0, 0.35, 0]));
  hydrant.add(mesh(new SphereGeometry(0.17, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2), solid("#d7262e"), [0, 0.7, 0]));
  hydrant.add(box(0.5, 0.1, 0.1, solid("#b81d24"), [0, 0.48, 0]));
  return hydrant;
}

export interface BuildingOptions {
  width: number;
  depth: number;
  floors: number;
  color: string;
  /** Fraction of windows lit; which ones is fixed by `seed`, so the façade is stable. */
  litFraction: number;
  seed: number;
}

const FLOOR_HEIGHT = 3.2;

/** A storefront-and-walkup block face: a body, a cornice and a lit/unlit window grid on the street side (+z). */
export function buildBuilding(options: BuildingOptions): Group {
  const building = new Group();
  const height = options.floors * FLOOR_HEIGHT;
  building.add(box(options.width, height, options.depth, solid(options.color), [0, height / 2, 0]));
  building.add(box(options.width + 0.3, 0.35, options.depth + 0.3, solid("#2b2f38"), [0, height + 0.17, 0]));
  const lit = solid("#ffe2a8", { emissive: "#ffc864", emissiveIntensity: 1.1 });
  const dark = solid("#2a3446", { metalness: 0.3, roughness: 0.3 });
  const columns = Math.max(1, Math.floor(options.width / 2.2));
  for (let floor = 1; floor < options.floors; floor += 1) {
    for (let c = 0; c < columns; c += 1) {
      const hash = Math.sin((floor * 31 + c * 17 + options.seed) * 12.9898) * 43758.5453;
      const isLit = hash - Math.floor(hash) < options.litFraction;
      const x = -options.width / 2 + (options.width / columns) * (c + 0.5);
      building.add(box(1.1, 1.5, 0.08, isLit ? lit : dark, [x, floor * FLOOR_HEIGHT + 1.4, options.depth / 2 + 0.03]));
    }
  }
  building.add(box(options.width * 0.8, 2.4, 0.1, solid("#93b7d6", { emissive: "#6fa8dc", emissiveIntensity: 0.35, metalness: 0.4 }), [0, 1.4, options.depth / 2 + 0.05]));
  return building;
}
