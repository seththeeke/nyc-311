import { CapsuleGeometry, SphereGeometry } from "three";
import { box, mesh, solid } from "../../three/threeKit";
import { HEAD_RADIUS, buildFigure, hairCap, type ResidentRig } from "../../residents/models/residentFigure";
import { CLOTH, DETAIL, HAIR, SKIN } from "../../residents/models/residentPalette";
import { CHEST_X, coffee } from "./teamProps";

/*
 * Priya Lafayette, CPO (#146): a teal blazer over a cream top, long
 * brown hair over one shoulder, a sticky note on the lapel (a resident's
 * idea, never lost) and a coffee for the next roadmap review.
 */
export function buildPriyaLafayette(): ResidentRig {
  const rig = buildFigure({ build: "AVERAGE", height: 1.02, skin: SKIN.MEDIUM, brows: HAIR.BROWN, top: CLOTH.TEAL, bottom: CLOTH.SAND });
  rig.head.add(hairCap(HAIR.BROWN, 0.55));
  /* Long hair falling down the back and over the left shoulder. */
  rig.head.add(mesh(new CapsuleGeometry(0.14, 0.22, 2, 8), solid(HAIR.BROWN), [-HEAD_RADIUS * 0.7, -0.2, 0]));
  const lock = mesh(new CapsuleGeometry(0.05, 0.2, 2, 6), solid(HAIR.BROWN), [0.02, -0.24, HEAD_RADIUS * 0.75]);
  lock.rotation.x = 0.2;
  rig.head.add(lock);
  rig.head.add(mesh(new SphereGeometry(0.02, 6, 4), solid(DETAIL.STEEL), [0.05, -0.04, -HEAD_RADIUS - 0.005]));
  const x = CHEST_X.AVERAGE;
  rig.torso.add(box(0.02, 0.3, 0.1, solid(CLOTH.CREAM), [x, 0.2, 0]));
  /* The sticky note. */
  rig.torso.add(box(0.012, 0.07, 0.07, solid(CLOTH.MUSTARD), [x + 0.01, 0.27, -0.1]));
  coffee(rig.leftArm);
  return rig;
}
