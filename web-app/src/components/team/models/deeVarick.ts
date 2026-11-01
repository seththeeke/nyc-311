import { CylinderGeometry, SphereGeometry, TorusGeometry } from "three";
import { box, mesh, solid } from "../../three/threeKit";
import { HEAD_RADIUS, buildFigure, hairCap, type ResidentRig } from "../../residents/models/residentFigure";
import { CLOTH, DETAIL, HAIR, SKIN } from "../../residents/models/residentPalette";
import { CHEST_X, clipboard, glasses } from "./teamProps";

/*
 * Dolores "Dee" Varick, COO (#146): the dispatcher. Broad, in an olive
 * field jacket with a mustard safety stripe, grey hair in a bun, reading
 * glasses, a dispatch headset and the shift roster on a clipboard.
 */
export function buildDeeVarick(): ResidentRig {
  const rig = buildFigure({ build: "BROAD", height: 0.97, skin: SKIN.LIGHT, brows: HAIR.GREY, top: CLOTH.OLIVE, bottom: CLOTH.NAVY });
  rig.head.add(hairCap(HAIR.GREY, 0.5));
  rig.head.add(mesh(new SphereGeometry(0.09, 8, 6), solid(HAIR.GREY), [-HEAD_RADIUS * 0.75, HEAD_RADIUS * 0.7, 0]));
  glasses(rig.head, CLOTH.RUST, 4);
  /* Headset: band over the crown, one ear cup, and a boom to the mouth. */
  const band = mesh(new TorusGeometry(HEAD_RADIUS + 0.03, 0.014, 4, 12, Math.PI), solid(CLOTH.CHARCOAL), [-0.02, 0, 0]);
  band.rotation.y = Math.PI / 2;
  rig.head.add(band);
  const cup = mesh(new CylinderGeometry(0.07, 0.07, 0.05, 10), solid(CLOTH.CHARCOAL), [-0.02, 0, HEAD_RADIUS + 0.02]);
  cup.rotation.x = Math.PI / 2;
  rig.head.add(cup);
  const boom = box(0.2, 0.014, 0.014, solid(CLOTH.CHARCOAL), [0.1, -0.08, HEAD_RADIUS - 0.01]);
  boom.rotation.y = 0.5;
  rig.head.add(boom, mesh(new SphereGeometry(0.022, 6, 4), solid(DETAIL.EYE), [0.2, -0.08, 0.16]));
  /* The safety stripe round the jacket. */
  const stripe = mesh(new CylinderGeometry(0.225, 0.232, 0.04, 10), solid(CLOTH.MUSTARD), [0, 0.14, 0]);
  rig.torso.add(stripe, box(0.012, 0.3, 0.012, solid(DETAIL.STEEL), [CHEST_X.BROAD + 0.01, 0.22, 0]));
  clipboard(rig.leftArm, CLOTH.CHARCOAL);
  return rig;
}
