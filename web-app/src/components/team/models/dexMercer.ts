import { SphereGeometry, TorusGeometry } from "three";
import { box, mesh, solid } from "../../three/threeKit";
import { HEAD_RADIUS, buildFigure, hairCap, type ResidentRig } from "../../residents/models/residentFigure";
import { CLOTH, DETAIL, HAIR, SKIN } from "../../residents/models/residentPalette";
import { CHEST_X, HAND_Y } from "./teamProps";

/*
 * Dex Mercer, devx-agent (#146): the repo's handyman. A rust beanie, a
 * full brown beard, an olive work shirt over a cream tee, a tool belt and
 * a wrench in hand for whatever's slowing CI down today.
 */
export function buildDexMercer(): ResidentRig {
  const rig = buildFigure({ build: "BROAD", height: 1, skin: SKIN.MEDIUM, brows: HAIR.BROWN, top: CLOTH.OLIVE, bottom: CLOTH.DENIM });
  rig.head.add(hairCap(HAIR.BROWN, 0.45));
  rig.head.add(mesh(new SphereGeometry(HEAD_RADIUS + 0.016, 12, 5, Math.PI / 2, Math.PI, Math.PI * 0.6, Math.PI * 0.4), solid(HAIR.BROWN)));
  /* Beanie with a turned-up cuff. */
  rig.head.add(mesh(new SphereGeometry(HEAD_RADIUS + 0.03, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2.6), solid(CLOTH.RUST), [-0.02, 0.04, 0]));
  const cuff = mesh(new TorusGeometry(HEAD_RADIUS * 0.82, 0.03, 4, 14), solid(CLOTH.RUST), [-0.02, 0.15, 0]);
  cuff.rotation.x = Math.PI / 2;
  rig.head.add(cuff);
  const x = CHEST_X.BROAD;
  rig.torso.add(box(0.02, 0.3, 0.11, solid(CLOTH.CREAM), [x, 0.2, 0]));
  /* Tool belt with two pouches. */
  const belt = mesh(new TorusGeometry(0.235, 0.025, 4, 12), solid(CLOTH.SAND), [0, 0.04, 0]);
  belt.rotation.x = Math.PI / 2;
  rig.torso.add(belt);
  for (const z of [0.15, -0.15]) rig.torso.add(box(0.08, 0.1, 0.07, solid(CLOTH.SAND), [0.17, 0, z]));
  /* The wrench: a handle and an open jaw. */
  rig.leftArm.add(box(0.025, 0.24, 0.02, solid(DETAIL.STEEL), [0.04, HAND_Y - 0.04, 0.03]));
  const jaw = mesh(new TorusGeometry(0.035, 0.014, 4, 8, Math.PI * 1.4), solid(DETAIL.STEEL), [0.04, HAND_Y - 0.18, 0.03]);
  jaw.rotation.y = Math.PI / 2;
  rig.leftArm.add(jaw);
  return rig;
}
