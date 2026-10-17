import { SphereGeometry } from "three";
import { box, mesh, solid } from "../../three/threeKit";
import { HEAD_RADIUS, buildFigure, hairCap, type ResidentRig } from "./residentFigure";
import { CLOTH, DETAIL, HAIR, SKIN } from "./residentPalette";

/*
 * Juniper (customer/backend/residents/juniper.json): the night-shift
 * hospital porter who cycles home at dawn. Slight and tall, teal scrubs
 * and navy trousers, a slate bike helmet over a tied-back bun, and one
 * reflective sash — the only bright note in any resident's palette.
 */
export function buildJuniper(): ResidentRig {
  const rig = buildFigure({ build: "SLIGHT", height: 1.04, skin: SKIN.DEEP, brows: HAIR.BLACK, top: CLOTH.TEAL, bottom: CLOTH.NAVY });
  rig.head.add(hairCap(HAIR.BLACK, 0.5));
  rig.head.add(mesh(new SphereGeometry(0.075, 8, 6), solid(HAIR.BLACK), [-HEAD_RADIUS * 1.02, 0.02, 0]));
  /* Helmet shell with a reflective stripe along the crown. */
  rig.head.add(mesh(new SphereGeometry(HEAD_RADIUS + 0.04, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2.9), solid(CLOTH.SLATE), [-0.02, 0.05, 0]));
  rig.head.add(box(0.26, 0.02, 0.04, solid(DETAIL.REFLECTIVE), [-0.02, HEAD_RADIUS + 0.06, 0]));
  /* Reflective sash from shoulder to hip. */
  const sash = box(0.03, 0.44, 0.05, solid(DETAIL.REFLECTIVE), [0.16, 0.2, 0]);
  sash.rotation.x = 0.7;
  rig.torso.add(sash);
  return rig;
}
