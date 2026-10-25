import { CylinderGeometry, SphereGeometry, TorusGeometry } from "three";
import { box, mesh, solid } from "../../three/threeKit";
import { EYE_HEIGHT, EYE_SPACING, HEAD_RADIUS, buildFigure, hairCap, type ResidentRig } from "./residentFigure";
import { CLOTH, DETAIL, HAIR, SKIN } from "./residentPalette";

/*
 * Sassafras (customer/backend/residents/sassafras.json): the Staten
 * Island remote engineer. Slight, in a denim jacket over a cream tee and
 * charcoal trousers; a short brown beard, thick square glasses and
 * chunky over-ear headphones.
 */
export function buildSassafras(): ResidentRig {
  const rig = buildFigure({ build: "SLIGHT", height: 1, skin: SKIN.TAN, brows: HAIR.BROWN, top: CLOTH.DENIM, bottom: CLOTH.CHARCOAL });
  rig.head.add(hairCap(HAIR.BROWN, 0.45));
  /* The beard: the lower front quarter of a slightly larger sphere, under the smile. */
  rig.head.add(mesh(new SphereGeometry(HEAD_RADIUS + 0.014, 12, 5, Math.PI / 2, Math.PI, Math.PI * 0.64, Math.PI * 0.36), solid(HAIR.BROWN)));
  /* Square glasses: four-sided rings, turned to face forward, and a bridge. */
  for (const side of [1, -1]) {
    const frame = mesh(new TorusGeometry(0.062, 0.013, 4, 4), solid(DETAIL.EYE), [HEAD_RADIUS * 0.97, EYE_HEIGHT, side * EYE_SPACING]);
    frame.rotation.set(0, Math.PI / 2, Math.PI / 4);
    rig.head.add(frame);
  }
  rig.head.add(box(0.012, 0.014, EYE_SPACING * 0.7, solid(DETAIL.EYE), [HEAD_RADIUS * 0.99, EYE_HEIGHT + 0.02, 0]));
  /* Headphones: a band arching over the crown and a cup on each ear. */
  const band = mesh(new TorusGeometry(HEAD_RADIUS + 0.045, 0.022, 4, 12, Math.PI), solid(CLOTH.CHARCOAL), [-0.02, 0, 0]);
  band.rotation.y = Math.PI / 2;
  rig.head.add(band);
  for (const side of [1, -1]) {
    const cup = mesh(new CylinderGeometry(0.085, 0.085, 0.06, 10), solid(CLOTH.CHARCOAL), [-0.02, 0, side * (HEAD_RADIUS + 0.03)]);
    cup.rotation.x = Math.PI / 2;
    rig.head.add(cup);
  }
  /* The cream tee showing between the open jacket fronts. */
  rig.torso.add(box(0.02, 0.32, 0.1, solid(CLOTH.CREAM), [0.155, 0.2, 0]));
  return rig;
}
