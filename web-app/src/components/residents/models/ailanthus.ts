import { CylinderGeometry } from "three";
import { box, mesh, solid } from "../../three/threeKit";
import { HEAD_RADIUS, buildFigure, hairCap, type ResidentRig } from "./residentFigure";
import { CLOTH, DETAIL, HAIR, SKIN } from "./residentPalette";

/*
 * Ailanthus (customer/backend/residents/ailanthus.json): the quiet
 * Bensonhurst businessman. Broad, in a charcoal suit with dark lapels
 * over an open cream collar, slicked black hair under a charcoal fedora.
 */
export function buildAilanthus(): ResidentRig {
  const rig = buildFigure({ build: "BROAD", height: 1.02, skin: SKIN.LIGHT, brows: HAIR.BLACK, top: CLOTH.CHARCOAL, bottom: CLOTH.CHARCOAL });
  rig.head.add(hairCap(HAIR.BLACK, 0.4));
  /* Fedora: a wide brim, a tall crown and a black band, tipped forward a touch. */
  const hat = mesh(new CylinderGeometry(HEAD_RADIUS * 1.5, HEAD_RADIUS * 1.5, 0.02, 14), solid(CLOTH.CHARCOAL), [0, HEAD_RADIUS * 0.62, 0]);
  hat.add(mesh(new CylinderGeometry(HEAD_RADIUS * 0.78, HEAD_RADIUS * 0.9, 0.17, 12), solid(CLOTH.CHARCOAL), [0, 0.09, 0]));
  hat.add(mesh(new CylinderGeometry(HEAD_RADIUS * 0.91, HEAD_RADIUS * 0.92, 0.04, 12), solid(DETAIL.EYE), [0, 0.03, 0]));
  /* The pinch at the front of the crown. */
  hat.add(box(0.04, 0.06, 0.12, solid(CLOTH.CHARCOAL), [HEAD_RADIUS * 0.72, 0.13, 0]));
  hat.rotation.z = -0.1;
  rig.head.add(hat);
  /* Open cream collar in the V of the jacket, dark lapels either side, a folded pocket square. */
  rig.torso.add(box(0.03, 0.14, 0.1, solid(CLOTH.CREAM), [0.205, 0.33, 0]));
  for (const side of [1, -1]) {
    const lapel = box(0.03, 0.24, 0.05, solid(DETAIL.SHOE), [0.21, 0.27, side * 0.07]);
    lapel.rotation.x = side * 0.35;
    rig.torso.add(lapel);
  }
  rig.torso.add(box(0.03, 0.03, 0.05, solid(CLOTH.CREAM), [0.215, 0.3, 0.13]));
  return rig;
}
