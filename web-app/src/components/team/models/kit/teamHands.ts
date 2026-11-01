import { CapsuleGeometry, Group, type Material, type Object3D, Quaternion, Vector3 } from "three";
import type { TeamRig } from "./teamBody";
import { part, rounded } from "./teamShapes";

/* The executives' hands (#146): a palm, four two-jointed fingers curled toward it and a thumb. */

/** A hand: palm, four curled fingers and a thumb. `side` is +1 for the left hand, -1 for the right. */
export function buildHand(material: Material, side: number, scale = 1): { hand: Group; grip: Group } {
  const hand = new Group();
  hand.scale.setScalar(scale);
  hand.add(part(rounded(0.075, 0.085, 0.036, 0.016), material, [0, -0.045, 0]));
  for (let i = 0; i < 4; i++) {
    const finger = new Group();
    finger.position.set(0.027 - i * 0.018, -0.085, 0);
    finger.rotation.set(side * 0.9, 0, 0);
    finger.add(part(new CapsuleGeometry(0.0085, 0.03 - Math.abs(i - 1.5) * 0.004, 4, 8), material, [0, -0.02, 0]));
    const tip = new Group();
    tip.position.set(0, -0.038, 0);
    tip.rotation.set(side * 0.8, 0, 0);
    tip.add(part(new CapsuleGeometry(0.008, 0.016, 4, 8), material, [0, -0.012, 0]));
    finger.add(tip);
    hand.add(finger);
  }
  const thumb = part(new CapsuleGeometry(0.0105, 0.035, 4, 8), material, [0.04, -0.05, -side * 0.018], [-side * 0.5, 0, 0.7]);
  hand.add(thumb);
  const grip = new Group();
  grip.position.set(0, -0.085, -side * 0.03);
  hand.add(grip);
  return { hand, grip };
}


/** How far above the floor `grip` is, in the grip's own units, so a staff or haft can reach the ground. */
export function heightAboveFloor(rig: TeamRig, grip: Group): number {
  rig.root.updateMatrixWorld(true);
  return grip.getWorldPosition(new Vector3()).y / rig.root.scale.y;
}

/** Hangs `item` on `parent` at `anchor` (parent space) plus `lift` (world space), turned upright in the world. */
export function placeUpright(rig: TeamRig, parent: Group, item: Group, anchor: [number, number, number], lift: [number, number, number] = [0, 0, 0]): void {
  rig.root.updateMatrixWorld(true);
  const point = parent.localToWorld(new Vector3(...anchor));
  point.add(new Vector3(...lift).multiplyScalar(rig.root.scale.y));
  parent.add(item);
  item.position.copy(parent.worldToLocal(point));
  item.quaternion.copy(parent.getWorldQuaternion(new Quaternion()).invert());
}

/** World up, as a direction in `node`'s own space, one world unit long: for lifting a held prop straight up however the hand is turned. */
export function worldUpIn(node: Object3D): Vector3 {
  node.updateWorldMatrix(true, false);
  const scale = node.getWorldScale(new Vector3()).y;
  return new Vector3(0, 1, 0).applyQuaternion(node.getWorldQuaternion(new Quaternion()).invert()).divideScalar(scale);
}
