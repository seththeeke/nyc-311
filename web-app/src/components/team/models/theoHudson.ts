import { CylinderGeometry, SphereGeometry, TorusGeometry } from "three";
import { box, mesh, solid } from "../../three/threeKit";
import { HEAD_RADIUS, buildFigure, hairCap, type ResidentRig } from "../../residents/models/residentFigure";
import { CLOTH, DETAIL, HAIR, SKIN } from "../../residents/models/residentPalette";
import { CHEST_X, laptop } from "./teamProps";

/*
 * Theo Hudson, CTO (#146): a charcoal hoodie over a cream tee, a tousled
 * black quiff, a short beard, headphones round the neck and a laptop
 * under the arm on the way to the next design review.
 */
export function buildTheoHudson(): ResidentRig {
  const rig = buildFigure({ build: "AVERAGE", height: 1.05, skin: SKIN.LIGHT, brows: HAIR.BLACK, top: CLOTH.CHARCOAL, bottom: CLOTH.DENIM });
  rig.head.add(hairCap(HAIR.BLACK, 0.42));
  rig.head.add(mesh(new SphereGeometry(0.12, 8, 5), solid(HAIR.BLACK), [0.08, HEAD_RADIUS * 0.82, 0]));
  rig.head.add(mesh(new SphereGeometry(HEAD_RADIUS + 0.012, 12, 5, Math.PI / 2, Math.PI, Math.PI * 0.66, Math.PI * 0.34), solid(HAIR.BLACK)));
  /* The hood bunched behind the neck, and the drawstrings. */
  const hood = mesh(new TorusGeometry(0.14, 0.055, 5, 10), solid(CLOTH.CHARCOAL), [-0.07, 0.4, 0]);
  hood.rotation.y = Math.PI / 2;
  rig.torso.add(hood);
  const x = CHEST_X.AVERAGE;
  rig.torso.add(box(0.02, 0.06, 0.1, solid(CLOTH.CREAM), [x - 0.01, 0.37, 0]));
  for (const z of [0.035, -0.035]) rig.torso.add(box(0.01, 0.12, 0.01, solid(CLOTH.CREAM), [x + 0.01, 0.28, z]));
  /* Headphones resting round the neck. */
  const band = mesh(new TorusGeometry(0.17, 0.02, 4, 12), solid(DETAIL.EYE), [0.02, 0.42, 0]);
  band.rotation.x = Math.PI / 2;
  rig.torso.add(band);
  for (const side of [1, -1]) {
    const cup = mesh(new CylinderGeometry(0.06, 0.06, 0.04, 8), solid(DETAIL.EYE), [0.1, 0.42, side * 0.15]);
    cup.rotation.x = Math.PI / 2;
    rig.torso.add(cup);
  }
  laptop(rig.leftArm);
  return rig;
}
