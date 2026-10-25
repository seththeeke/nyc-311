import { CapsuleGeometry, CylinderGeometry, Group, Quaternion, TorusGeometry, Vector3 } from "three";
import { box, mesh, place, solid } from "../../three/threeKit";
import { HEAD_RADIUS, buildFigure, hairCap, type ResidentRig } from "./residentFigure";
import { CLOTH, DETAIL, HAIR, SKIN } from "./residentPalette";

/*
 * Dogwood (customer/backend/residents/dogwood.json): the Park Slope dog
 * walker. A slate windbreaker, jeans and a cream waist pouch; an auburn
 * ponytail under a sand sun visor; leashes from one hand to two small
 * low-poly dogs at their feet.
 */

/* Where the non-waving hand hangs in the figure's own frame (before its height scale). */
const HAND = new Vector3(0.02, 0.5, 0.3);

/* A small blocky dog standing at `at`, facing +x. */
function dog(color: string, at: [number, number, number]): Group {
  const body = place(new Group(), ...at);
  body.add(box(0.24, 0.1, 0.11, solid(color), [0, 0.14, 0]));
  body.add(box(0.1, 0.09, 0.09, solid(color), [0.14, 0.22, 0]));
  body.add(box(0.05, 0.04, 0.06, solid(color), [0.21, 0.2, 0]));
  for (const side of [1, -1]) body.add(box(0.02, 0.05, 0.025, solid(DETAIL.SHOE), [0.13, 0.28, side * 0.03]));
  for (const x of [0.09, -0.09]) for (const z of [0.035, -0.035]) body.add(box(0.035, 0.1, 0.035, solid(color), [x, 0.05, z]));
  const tail = box(0.02, 0.09, 0.02, solid(color), [-0.13, 0.22, 0]);
  tail.rotation.z = 0.6;
  body.add(tail);
  return body;
}

/* A thin leash from `from` to `to`. */
function leash(from: Vector3, to: Vector3): ReturnType<typeof mesh> {
  const span = to.clone().sub(from);
  const line = mesh(new CylinderGeometry(0.006, 0.006, span.length(), 4), solid(CLOTH.CHARCOAL));
  line.position.copy(from.clone().add(to).multiplyScalar(0.5));
  line.quaternion.copy(new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), span.normalize()));
  return line;
}

export function buildDogwood(): ResidentRig {
  const rig = buildFigure({ build: "AVERAGE", height: 0.95, skin: SKIN.MEDIUM, brows: HAIR.AUBURN, top: CLOTH.SLATE, bottom: CLOTH.DENIM });
  rig.head.add(hairCap(HAIR.AUBURN, 0.5));
  /* Ponytail out the back of the visor. */
  const tail = mesh(new CapsuleGeometry(0.05, 0.16, 2, 6), solid(HAIR.AUBURN), [-HEAD_RADIUS * 1.08, -0.02, 0]);
  tail.rotation.z = -0.35;
  rig.head.add(tail);
  /* Sun visor: a band round the head and a long brim, no crown. */
  const band = mesh(new TorusGeometry(HEAD_RADIUS + 0.012, 0.022, 4, 14), solid(CLOTH.SAND), [0, 0.1, 0]);
  band.rotation.x = Math.PI / 2;
  rig.head.add(band);
  const brim = box(0.2, 0.02, 0.28, solid(CLOTH.SAND), [HEAD_RADIUS * 0.95, 0.11, 0]);
  brim.rotation.z = -0.2;
  rig.head.add(brim);
  /* Waist pouch and the windbreaker's zip. */
  rig.torso.add(box(0.06, 0.08, 0.2, solid(CLOTH.CREAM), [0.2, 0.04, 0]));
  rig.torso.add(box(0.012, 0.3, 0.012, solid(DETAIL.STEEL), [0.19, 0.24, 0]));
  /* Two dogs at heel, each on a leash to the hand. */
  const pack: [string, [number, number, number]][] = [
    [HAIR.BROWN, [0.42, 0, 0.42]],
    [CLOTH.CREAM, [0.2, 0, 0.62]],
  ];
  for (const [color, at] of pack) {
    rig.root.add(dog(color, at));
    rig.root.add(leash(HAND, new Vector3(at[0] + 0.1, 0.2, at[2])));
  }
  return rig;
}
