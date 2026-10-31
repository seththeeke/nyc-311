import { CylinderGeometry, type Group, TorusGeometry } from "three";
import { box, mesh, solid } from "../../three/threeKit";
import { EYE_HEIGHT, EYE_SPACING, HEAD_RADIUS, type Build } from "../../residents/models/residentFigure";
import { CLOTH, DETAIL, OFFICE } from "../../residents/models/residentPalette";

/*
 * Props the executive figures share (#146), on the resident body
 * (13-customer-simulation.md Appendix P). Held items hang from the left
 * hand, which stays down while the right arm waves.
 */

/* How far forward the front of the torso sits for each build, so props sit on the clothes. */
export const CHEST_X: Record<Build, number> = { SLIGHT: 0.155, AVERAGE: 0.18, BROAD: 0.205 };

/* Where the left hand is in the arm's own frame. */
export const HAND_Y = -0.45;

/** Glasses over both eyes: round (`sides` 10) or square (4), plus a bridge. */
export function glasses(head: Group, color: string, sides = 10): void {
  for (const side of [1, -1]) {
    const frame = mesh(new TorusGeometry(0.058, 0.011, 4, sides), solid(color), [HEAD_RADIUS * 0.97, EYE_HEIGHT, side * EYE_SPACING]);
    frame.rotation.set(0, Math.PI / 2, sides === 4 ? Math.PI / 4 : 0);
    head.add(frame);
  }
  head.add(box(0.012, 0.012, EYE_SPACING * 0.7, solid(color), [HEAD_RADIUS * 0.99, EYE_HEIGHT + 0.02, 0]));
}

/** A shirt front with a tie down it, for a jacketed figure. */
export function shirtAndTie(torso: Group, build: Build, tie: string): void {
  const x = CHEST_X[build];
  torso.add(box(0.02, 0.3, 0.11, solid(OFFICE.SHIRT), [x, 0.22, 0]));
  torso.add(box(0.024, 0.04, 0.05, solid(tie), [x + 0.005, 0.35, 0]));
  torso.add(box(0.024, 0.22, 0.045, solid(tie), [x + 0.008, 0.21, 0]));
}

/** A closed laptop tucked under the left arm. */
export function laptop(arm: Group): void {
  const lid = box(0.24, 0.3, 0.025, solid(DETAIL.STEEL), [0.02, -0.26, 0.06]);
  arm.add(lid);
}

/** A clipboard with a sheet, held in the left hand. */
export function clipboard(arm: Group, board: string): void {
  arm.add(box(0.2, 0.26, 0.02, solid(board), [0.06, HAND_Y + 0.02, 0.04]));
  arm.add(box(0.16, 0.2, 0.022, solid(CLOTH.CREAM), [0.065, HAND_Y + 0.01, 0.042]));
  arm.add(box(0.06, 0.025, 0.026, solid(DETAIL.STEEL), [0.06, HAND_Y + 0.14, 0.042]));
}

/** A takeaway coffee cup in the left hand. */
export function coffee(arm: Group): void {
  arm.add(mesh(new CylinderGeometry(0.045, 0.035, 0.12, 8), solid(CLOTH.CREAM), [0.06, HAND_Y, 0.02]));
  arm.add(mesh(new CylinderGeometry(0.047, 0.047, 0.02, 8), solid(CLOTH.CHARCOAL), [0.06, HAND_Y + 0.065, 0.02]));
}
