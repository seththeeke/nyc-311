import { CylinderGeometry, SphereGeometry, TorusGeometry } from "three";
import { box, mesh, solid } from "../../three/threeKit";
import { EYE_HEIGHT, EYE_SPACING, HEAD_RADIUS, buildFigure, hairCap, type ResidentRig } from "./residentFigure";
import { CLOTH, DETAIL, HAIR, SKIN } from "./residentPalette";

/*
 * Sycamore (customer/backend/residents/sycamore.json): the retired transit
 * worker from Queens. An olive cardigan buttoned to the top, sand trousers,
 * grey hair under a charcoal flat cap, and round reading glasses.
 */
export function buildSycamore(): ResidentRig {
  const rig = buildFigure({ build: "AVERAGE", height: 0.96, skin: SKIN.LIGHT, brows: HAIR.GREY, top: CLOTH.OLIVE, bottom: CLOTH.SAND });
  rig.head.add(hairCap(HAIR.GREY, 0.5));
  /* Flat cap: a squat crown and a brim over the eyes. */
  rig.head.add(mesh(new CylinderGeometry(HEAD_RADIUS * 0.98, HEAD_RADIUS * 1.02, 0.07, 12), solid(CLOTH.CHARCOAL), [0, HEAD_RADIUS * 0.8, 0]));
  rig.head.add(box(0.14, 0.02, 0.26, solid(CLOTH.CHARCOAL), [HEAD_RADIUS * 0.85, HEAD_RADIUS * 0.72, 0]));
  /* Round glasses over each eye, joined at the bridge. */
  for (const side of [1, -1]) {
    const lens = mesh(new TorusGeometry(0.05, 0.009, 4, 10), solid(DETAIL.STEEL), [HEAD_RADIUS * 0.97, EYE_HEIGHT, side * EYE_SPACING]);
    lens.rotation.y = Math.PI / 2;
    rig.head.add(lens);
  }
  rig.head.add(box(0.01, 0.01, EYE_SPACING * 0.9, solid(DETAIL.STEEL), [HEAD_RADIUS * 0.99, EYE_HEIGHT + 0.01, 0]));
  /* Cardigan buttons down the front. */
  for (const y of [0.08, 0.17, 0.26, 0.35]) rig.torso.add(mesh(new SphereGeometry(0.014, 6, 4), solid(CLOTH.CREAM), [0.185, y, 0]));
  return rig;
}
