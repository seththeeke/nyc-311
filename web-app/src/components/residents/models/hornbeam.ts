import { box, solid } from "../../three/threeKit";
import { HEAD_RADIUS, buildFigure, hairCap, type ResidentRig } from "./residentFigure";
import { CLOTH, DETAIL, HAIR, SKIN } from "./residentPalette";

/*
 * Hornbeam (customer/backend/residents/hornbeam.json): the Midtown
 * corporate lawyer. Tall and straight like the tree, in a navy suit with a
 * slate tie down a cream shirt, neat side-parted hair and a briefcase.
 */
export function buildHornbeam(): ResidentRig {
  const rig = buildFigure({ build: "AVERAGE", height: 1.08, skin: SKIN.MEDIUM, brows: HAIR.BROWN, top: CLOTH.NAVY, bottom: CLOTH.NAVY });
  rig.head.add(hairCap(HAIR.BROWN, 0.42));
  /* The side part: a swept ridge of hair along one side of the crown. */
  const sweep = box(0.24, 0.04, 0.12, solid(HAIR.BROWN), [0.03, HEAD_RADIUS * 0.93, 0.07]);
  sweep.rotation.x = 0.3;
  rig.head.add(sweep);
  /* Shirt front, tie and knot, with charcoal lapels framing them. */
  rig.torso.add(box(0.03, 0.2, 0.1, solid(CLOTH.CREAM), [0.178, 0.29, 0]));
  rig.torso.add(box(0.03, 0.22, 0.04, solid(CLOTH.SLATE), [0.19, 0.23, 0]));
  rig.torso.add(box(0.035, 0.035, 0.05, solid(CLOTH.SLATE), [0.188, 0.36, 0]));
  for (const side of [1, -1]) {
    const lapel = box(0.03, 0.22, 0.045, solid(CLOTH.CHARCOAL), [0.185, 0.28, side * 0.07]);
    lapel.rotation.x = side * 0.32;
    rig.torso.add(lapel);
  }
  /* The briefcase, hanging from the hand that does not wave. */
  rig.leftArm.add(box(0.3, 0.22, 0.08, solid(CLOTH.CHARCOAL), [0.02, -0.6, 0.05]));
  rig.leftArm.add(box(0.1, 0.03, 0.02, solid(DETAIL.SHOE), [0.02, -0.48, 0.05]));
  rig.leftArm.add(box(0.04, 0.03, 0.085, solid(DETAIL.STEEL), [0.02, -0.53, 0.05]));
  return rig;
}
