import { Box3, CylinderGeometry, Group, type Object3D, Vector3 } from "three";
import { DETAIL } from "../../../residents/models/residentPalette";
import type { BodyStyle, TeamRig } from "./teamBody";
import { satin } from "./teamMaterials";
import { ball, limb, part, rounded } from "./teamShapes";

/*
 * The executives' legs (#146): a hip pivot with the thigh, a knee pivot
 * with the shin and an ankle pivot with the shoe, so a figure can crouch,
 * jump and land with its feet flat.
 */

export interface Leg {
  hip: Group;
  shin: Group;
  foot: Group;
}

/* Height of the ankle pivot above the floor, in figure units. */
export const ANKLE = 0.07;

export function buildLeg(style: BodyStyle, hipY: number): Leg {
  const length = style.legs ?? 0.5;
  const r = (style.limbs ?? 0.055) * 1.35;
  const cloth = satin(style.bottom);
  const hip = new Group();
  hip.add(part(limb(length * 0.52, r * 1.15, r * 0.88), cloth));
  const shin = new Group();
  shin.position.y = -length * 0.5;
  shin.add(part(ball(r * 0.9, 16, 12), cloth));
  shin.add(part(limb(length * 0.5, r * 0.88, r * 0.68), cloth));
  hip.add(shin);
  const foot = new Group();
  foot.position.y = -(hipY - ANKLE) + length * 0.5;
  const shoe = satin(style.shoes, { roughness: 0.35 });
  foot.add(part(rounded(0.24, 0.085, 0.13, 0.04), shoe, [0.045, -ANKLE + 0.045, 0]));
  foot.add(part(new CylinderGeometry(r * 0.75, r * 0.85, 0.08, 20), shoe, [0, -ANKLE + 0.1, 0]));
  foot.add(part(rounded(0.25, 0.018, 0.135, 0.008), satin(DETAIL.SHOE, { roughness: 0.9 }), [0.045, -ANKLE + 0.009, 0]));
  shin.add(foot);
  return { hip, shin, foot };
}

function centreIn(item: Object3D, frame: Object3D): Vector3 {
  return frame.worldToLocal(new Box3().setFromObject(item).getCenter(new Vector3()));
}

/**
 * Moves whatever a character hung on a leg's hip pivot (boots, buckles,
 * shin plates) onto the shin or foot it sits on, keeping it in place, so
 * it bends with the knee and ankle. Runs once, in the rest pose.
 */
export function settleLegs(rig: TeamRig): void {
  rig.root.updateMatrixWorld(true);
  for (const [hip, shin, foot] of [[rig.leftLeg, rig.leftShin, rig.leftFoot], [rig.rightLeg, rig.rightShin, rig.rightFoot]] as const) {
    for (const item of hip.children.filter((child) => child !== shin)) {
      const y = centreIn(item, hip).y;
      const ankle = hip.worldToLocal(foot.getWorldPosition(new Vector3())).y + 0.05;
      if (y < ankle) foot.attach(item);
      else if (y < shin.position.y - 0.01) shin.attach(item);
    }
  }
}
