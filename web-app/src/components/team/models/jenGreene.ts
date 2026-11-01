import { CapsuleGeometry } from "three";
import { box, mesh, solid } from "../../three/threeKit";
import { HEAD_RADIUS, buildFigure, hairCap, type ResidentRig } from "../../residents/models/residentFigure";
import { CLOTH, DETAIL, HAIR, SKIN } from "../../residents/models/residentPalette";
import { CHEST_X, glasses, laptop } from "./teamProps";

/*
 * Jen Greene, gen-purpose-dev (#146): an auburn high ponytail, square
 * glasses, a denim overshirt over a mustard tee and a sticker-covered
 * laptop, ready for whichever issue gets labelled next.
 */
export function buildJenGreene(): ResidentRig {
  const rig = buildFigure({ build: "SLIGHT", height: 0.96, skin: SKIN.LIGHT, brows: HAIR.AUBURN, top: CLOTH.DENIM, bottom: CLOTH.CHARCOAL });
  rig.head.add(hairCap(HAIR.AUBURN, 0.5));
  const tail = mesh(new CapsuleGeometry(0.055, 0.2, 2, 6), solid(HAIR.AUBURN), [-HEAD_RADIUS * 1.05, 0.08, 0]);
  tail.rotation.z = -0.5;
  rig.head.add(tail);
  glasses(rig.head, DETAIL.EYE, 4);
  rig.torso.add(box(0.02, 0.3, 0.1, solid(CLOTH.MUSTARD), [CHEST_X.SLIGHT, 0.2, 0]));
  laptop(rig.leftArm);
  /* Stickers on the lid. */
  rig.leftArm.add(box(0.05, 0.05, 0.005, solid(CLOTH.TEAL), [0.0, -0.2, 0.075]), box(0.04, 0.04, 0.005, solid(CLOTH.RUST), [0.06, -0.3, 0.075]));
  return rig;
}
