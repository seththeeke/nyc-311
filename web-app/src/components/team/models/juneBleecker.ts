import { SphereGeometry } from "three";
import { mesh, solid } from "../../three/threeKit";
import { buildFigure, hairCap, type ResidentRig } from "../../residents/models/residentFigure";
import { CLOTH, DETAIL, HAIR, OFFICE, SKIN } from "../../residents/models/residentPalette";
import { CHEST_X, clipboard, glasses } from "./teamProps";

/*
 * June Bleecker, Chief of Staff (#146): a plum blazer over a cream shirt,
 * a sleek black bob, round glasses and the clipboard with today's agenda.
 */
export function buildJuneBleecker(): ResidentRig {
  const rig = buildFigure({ build: "SLIGHT", height: 0.98, skin: SKIN.TAN, brows: HAIR.BLACK, top: OFFICE.PLUM, bottom: CLOTH.CHARCOAL });
  rig.head.add(hairCap(HAIR.BLACK, 0.58));
  /* The bob: fuller at the sides, cut level with the chin. */
  for (const side of [1, -1]) {
    const lock = mesh(new SphereGeometry(0.13, 8, 6), solid(HAIR.BLACK), [-0.05, -0.04, side * 0.19]);
    lock.scale.set(1.2, 1.1, 0.6);
    rig.head.add(lock);
  }
  glasses(rig.head, DETAIL.EYE);
  rig.torso.add(mesh(new SphereGeometry(0.06, 6, 4), solid(OFFICE.SHIRT), [CHEST_X.SLIGHT - 0.02, 0.36, 0]));
  clipboard(rig.leftArm, CLOTH.SAND);
  return rig;
}
