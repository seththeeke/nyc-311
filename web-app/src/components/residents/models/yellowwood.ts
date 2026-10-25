import { SphereGeometry } from "three";
import { box, mesh, solid } from "../../three/threeKit";
import { HEAD_RADIUS, buildFigure, hairCap, type ResidentRig } from "./residentFigure";
import { CLOTH, DETAIL, HAIR, SKIN } from "./residentPalette";

/*
 * Yellowwood (customer/backend/residents/yellowwood.json): the Bronx
 * school bus driver. Broad, in a denim shirt and sand trousers under a
 * mustard safety vest with steel stripes, and a navy baseball cap.
 */
export function buildYellowwood(): ResidentRig {
  const rig = buildFigure({ build: "BROAD", height: 0.98, skin: SKIN.DEEP, brows: HAIR.BLACK, top: CLOTH.DENIM, bottom: CLOTH.SAND });
  rig.head.add(hairCap(HAIR.BLACK, 0.38));
  /* Baseball cap: a rounded crown and a forward brim. */
  rig.head.add(mesh(new SphereGeometry(HEAD_RADIUS + 0.025, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2.6), solid(CLOTH.NAVY), [0, 0.03, 0]));
  const brim = box(0.2, 0.02, 0.26, solid(CLOTH.NAVY), [HEAD_RADIUS * 0.92, HEAD_RADIUS * 0.5, 0]);
  brim.rotation.z = -0.15;
  rig.head.add(brim);
  /* Safety vest: two front panels open over the shirt, a back panel, and a steel stripe across each. */
  for (const side of [1, -1]) {
    rig.torso.add(box(0.04, 0.34, 0.12, solid(CLOTH.MUSTARD), [0.215, 0.19, side * 0.1]));
    rig.torso.add(box(0.045, 0.035, 0.12, solid(DETAIL.STEEL), [0.22, 0.14, side * 0.1]));
  }
  rig.torso.add(box(0.04, 0.34, 0.34, solid(CLOTH.MUSTARD), [-0.215, 0.19, 0]));
  rig.torso.add(box(0.045, 0.035, 0.34, solid(DETAIL.STEEL), [-0.22, 0.14, 0]));
  return rig;
}
