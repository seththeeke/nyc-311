import { SphereGeometry } from "three";
import { box, mesh, solid } from "../../three/threeKit";
import { HEAD_RADIUS, buildFigure, hairCap, type ResidentRig } from "../../residents/models/residentFigure";
import { CLOTH, DETAIL, HAIR, OFFICE, SKIN } from "../../residents/models/residentPalette";
import { CHEST_X, glasses, shirtAndTie } from "./teamProps";

/*
 * Hal Pearl, CFO (#146): the Pearl Street banker. A navy three-piece
 * look with a burgundy tie, grey side-parted hair, a neat moustache,
 * square half-rims and a leather ledger in hand.
 */
export function buildHalPearl(): ResidentRig {
  const rig = buildFigure({ build: "AVERAGE", height: 1.03, skin: SKIN.DEEP, brows: HAIR.GREY, top: CLOTH.NAVY, bottom: CLOTH.NAVY, shoes: OFFICE.BURGUNDY });
  rig.head.add(hairCap(HAIR.GREY, 0.4));
  const moustache = mesh(new SphereGeometry(0.05, 8, 4), solid(HAIR.GREY), [HEAD_RADIUS * 0.95, -0.045, 0]);
  moustache.scale.set(0.4, 0.35, 1.3);
  rig.head.add(moustache);
  glasses(rig.head, DETAIL.STEEL, 4);
  shirtAndTie(rig.torso, "AVERAGE", OFFICE.BURGUNDY);
  /* Pocket square and the ledger. */
  rig.torso.add(box(0.015, 0.03, 0.05, solid(OFFICE.SHIRT), [CHEST_X.AVERAGE, 0.3, 0.12]));
  rig.leftArm.add(box(0.22, 0.28, 0.04, solid(OFFICE.BURGUNDY), [0.05, -0.44, 0.04]));
  return rig;
}
