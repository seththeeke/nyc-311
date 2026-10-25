import { SphereGeometry, TorusGeometry } from "three";
import { box, mesh, solid } from "../../three/threeKit";
import { HEAD_RADIUS, buildFigure, hairCap, type ResidentRig } from "./residentFigure";
import { CLOTH, HAIR, SKIN } from "./residentPalette";

/*
 * Ginkgo (customer/backend/residents/ginkgo.json): the NYU PhD student.
 * Slight, in a navy hoodie with the hood down and sand trousers; shaggy
 * brown hair under a slouchy rust beanie, and a laptop under one arm.
 */
export function buildGinkgo(): ResidentRig {
  const rig = buildFigure({ build: "SLIGHT", height: 0.98, skin: SKIN.TAN, brows: HAIR.BROWN, top: CLOTH.NAVY, bottom: CLOTH.SAND });
  rig.head.add(hairCap(HAIR.BROWN, 0.55));
  /* Shaggy tufts over the ears. */
  for (const side of [1, -1]) rig.head.add(mesh(new SphereGeometry(0.07, 6, 5), solid(HAIR.BROWN), [0.02, 0.0, side * HEAD_RADIUS * 0.9]));
  /* Slouchy beanie: a knit crown, a ribbed band, and the slouch falling to the back. */
  rig.head.add(mesh(new SphereGeometry(HEAD_RADIUS + 0.035, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2.4), solid(CLOTH.RUST), [-0.02, 0.06, 0]));
  const band = mesh(new TorusGeometry(HEAD_RADIUS + 0.012, 0.03, 4, 14), solid(CLOTH.RUST), [-0.01, 0.12, 0]);
  band.rotation.x = Math.PI / 2;
  rig.head.add(band);
  rig.head.add(mesh(new SphereGeometry(0.12, 8, 6), solid(CLOTH.RUST), [-0.17, 0.25, 0]));
  /* Hood down behind the neck, a front pocket and the drawstrings. */
  rig.torso.add(box(0.1, 0.09, 0.3, solid(CLOTH.NAVY), [-0.12, 0.4, 0]));
  rig.torso.add(box(0.02, 0.1, 0.2, solid(CLOTH.SLATE), [0.165, 0.1, 0]));
  for (const side of [1, -1]) rig.torso.add(box(0.012, 0.12, 0.012, solid(CLOTH.CREAM), [0.16, 0.3, side * 0.04]));
  /* A laptop held against the hip. */
  rig.leftArm.add(box(0.26, 0.19, 0.022, solid(CLOTH.SLATE), [0.02, -0.42, 0.07]));
  return rig;
}
