import { CylinderGeometry } from "three";
import { box, mesh, solid } from "../../three/threeKit";
import { HEAD_RADIUS, buildFigure, hairCap, type ResidentRig } from "./residentFigure";
import { CLOTH, HAIR, SKIN } from "./residentPalette";

/*
 * Hawthorn (customer/backend/residents/hawthorn.json): the Brooklyn baker.
 * Broad and solid, sleeves of a rust work shirt under a cream apron, a
 * short paper baker's cap over dark cropped hair.
 */
export function buildHawthorn(): ResidentRig {
  const rig = buildFigure({ build: "BROAD", height: 1, skin: SKIN.MEDIUM, brows: HAIR.BLACK, top: CLOTH.RUST, bottom: CLOTH.CHARCOAL });
  rig.head.add(hairCap(HAIR.BLACK, 0.42));
  rig.head.add(mesh(new CylinderGeometry(HEAD_RADIUS * 0.85, HEAD_RADIUS * 0.8, 0.12, 10), solid(CLOTH.CREAM), [-0.01, HEAD_RADIUS * 0.85, 0]));
  /* The apron: a bib down the front and a strap round the neck. */
  rig.torso.add(box(0.03, 0.34, 0.28, solid(CLOTH.CREAM), [0.205, 0.17, 0]));
  rig.torso.add(box(0.03, 0.04, 0.3, solid(CLOTH.CREAM), [0.185, 0.36, 0]));
  return rig;
}
