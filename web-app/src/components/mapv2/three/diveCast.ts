import { Group, type Mesh, type MeshBasicMaterial, type MeshStandardMaterial, RingGeometry, type Scene } from "three";
import { buildCrew, type CrewRig } from "./crewModel";
import { buildCone, buildDebris, buildPatch, buildPothole, buildRoller, type RollerRig } from "./props";
import { box, createPuffPool, glow, mesh, type PuffPool, solid } from "./threeKit";
import { buildTruck, type TruckRig } from "./truckModel";

/*
 * Everything that moves in the dive-in, built once and posed every frame
 * by diveChoreography.ts. The work site sits in the near lane at SITE.
 */

export const SITE = { x: 0, z: 2.8 } as const;
export const CUT = { width: 2.6, depth: 2.0 } as const;
export const TRUCK_PARK_X = -10;
export const TRUCK_START_X = -64;

export const CONE_SPOTS: readonly [number, number][] = [
  [-3.2, SITE.z - 2.3],
  [0, SITE.z - 2.5],
  [3.2, SITE.z - 2.3],
  [3.4, SITE.z + 2.2],
  [-3.4, SITE.z + 2.2],
  [-15, SITE.z + 1.4],
  [-19, SITE.z + 0.4],
];

export interface DiveCast {
  truck: TruckRig;
  crew: { cutter: CrewRig; raker: CrewRig; flagger: CrewRig };
  cones: Group[];
  pothole: Group;
  /** The four sides of the saw-cut outline, each a unit-length bar scaled along its run. */
  cutLines: Mesh[];
  cutMaterial: MeshBasicMaterial;
  sparks: PuffPool;
  debris: Mesh[];
  patch: Mesh;
  patchMaterial: MeshStandardMaterial;
  steam: PuffPool;
  roller: RollerRig;
  doneRing: Mesh;
  doneMaterial: MeshBasicMaterial;
}

export interface CutSide {
  /** Start corner, relative to SITE. */
  from: [number, number];
  /** Unit direction the side grows in, as [dx, dz]. */
  dir: [number, number];
  length: number;
}

const HALF_W = CUT.width / 2;
const HALF_D = CUT.depth / 2;

/* Clockwise from the near-left corner, so the saw travels one continuous loop. */
export const CUT_SIDES: readonly CutSide[] = [
  { from: [-HALF_W, HALF_D], dir: [1, 0], length: CUT.width },
  { from: [HALF_W, HALF_D], dir: [0, -1], length: CUT.depth },
  { from: [HALF_W, -HALF_D], dir: [-1, 0], length: CUT.width },
  { from: [-HALF_W, -HALF_D], dir: [0, 1], length: CUT.depth },
];

function buildCutLines(material: MeshBasicMaterial): Mesh[] {
  return CUT_SIDES.map((side) => {
    const bar = box(1, 0.03, 0.07, material, [SITE.x + side.from[0], 0.03, SITE.z + side.from[1]]);
    if (side.dir[0] === 0) bar.rotation.y = Math.PI / 2;
    return bar;
  });
}

export function buildDiveCast(scene: Scene): DiveCast {
  const truck = buildTruck("TRANSIT");
  truck.ground.visible = false;
  truck.root.position.set(TRUCK_START_X, 0, SITE.z);
  const crew = { cutter: buildCrew(0), raker: buildCrew(1), flagger: buildCrew(2) };
  const cones = CONE_SPOTS.map(([x, z]) => {
    const cone = buildCone();
    cone.position.set(x, 0, z);
    return cone;
  });
  const pothole = buildPothole();
  pothole.position.set(SITE.x, 0, SITE.z);
  const cutMaterial = glow("#ffb347", 0.95);
  const cutLines = buildCutLines(cutMaterial);
  const sparks = createPuffPool({ count: 14, color: "#ffc35a", size: 0.05, growTo: 0.4, rise: [0.4, 0.9, 0.6], lifetimeSeconds: 0.45, maxOpacity: 1, additive: true });
  const debris = Array.from({ length: 8 }, (_, i) => buildDebris(i));
  const patch = buildPatch();
  patch.position.set(SITE.x, 0.03, SITE.z);
  const patchMaterial = patch.material as MeshStandardMaterial;
  const steam = createPuffPool({ count: 10, color: "#e8edf3", size: 0.3, growTo: 3.2, rise: [0.3, 3, -0.2], lifetimeSeconds: 2.6, maxOpacity: 0.32 });
  steam.group.position.set(SITE.x, 0.1, SITE.z);
  const roller = buildRoller();
  const doneMaterial = glow("#34d399", 0.8);
  const doneRing = mesh(new RingGeometry(1.6, 1.85, 48).rotateX(-Math.PI / 2), doneMaterial, [SITE.x, 0.08, SITE.z]);
  const all = new Group();
  all.add(truck.root, crew.cutter.root, crew.raker.root, crew.flagger.root, pothole, patch, steam.group, sparks.group, roller.root, doneRing, ...cones, ...cutLines, ...debris);
  all.add(box(0.5, 0.35, 0.3, solid("#c0392b"), [TRUCK_PARK_X - 5.2, 0.18, SITE.z + 1.9]));
  scene.add(all);
  return { truck, crew, cones, pothole, cutLines, cutMaterial, sparks, debris, patch, patchMaterial, steam, roller, doneRing, doneMaterial };
}
