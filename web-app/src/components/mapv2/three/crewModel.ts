import { CapsuleGeometry, CylinderGeometry, Group, SphereGeometry } from "three";
import { box, mesh, place, solid } from "../../three/threeKit";

/*
 * A jointed low-poly road worker (~1.8 m): hips and shoulders are pivot
 * groups, so every pose is just rotations driven by time. Faces +x.
 */

export const CREW_POSES = ["IDLE", "WALK", "SHOVEL", "HAMMER", "SAW", "WAVE"] as const;
export type CrewPose = (typeof CREW_POSES)[number];
export type CrewTool = "SHOVEL" | "HAMMER" | "SAW" | "NONE";

export interface CrewRig {
  root: Group;
  leftArm: Group;
  rightArm: Group;
  leftLeg: Group;
  rightLeg: Group;
  torso: Group;
  tools: Record<Exclude<CrewTool, "NONE">, Group>;
}

const SKIN = ["#c98d6a", "#8d5a3b", "#f0c8a8", "#5e3b28"];
const VEST = "#c6f432";
const HAT = "#ff8a1f";

function limb(length: number, radius: number, color: string): Group {
  const pivot = new Group();
  pivot.add(mesh(new CapsuleGeometry(radius, length, 3, 6), solid(color), [0, -length / 2 - radius, 0]));
  return pivot;
}

function shovel(): Group {
  const tool = new Group();
  tool.add(mesh(new CylinderGeometry(0.025, 0.025, 1.3, 5), solid("#8a6a43"), [0, -0.55, 0]));
  tool.add(box(0.26, 0.32, 0.04, solid("#9aa3ad", { metalness: 0.6, roughness: 0.4 }), [0, -1.25, 0]));
  return tool;
}

function hammer(): Group {
  const tool = new Group();
  tool.add(box(0.16, 0.5, 0.16, solid("#e8b018"), [0, -0.45, 0]));
  tool.add(mesh(new CylinderGeometry(0.03, 0.03, 0.5, 5), solid("#9aa3ad", { metalness: 0.7 }), [0, -0.95, 0]));
  tool.add(box(0.5, 0.05, 0.05, solid("#2a2d33"), [0, -0.18, 0]));
  return tool;
}

function saw(): Group {
  const tool = new Group();
  tool.add(box(0.5, 0.22, 0.2, solid("#e05a1a"), [0.15, -0.55, 0]));
  tool.add(mesh(new CylinderGeometry(0.22, 0.22, 0.02, 12).rotateX(Math.PI / 2), solid("#c9ced6", { metalness: 0.8 }), [0.42, -0.62, 0.12]));
  return tool;
}

/** `variant` picks the skin tone, so a crew of several isn't a row of clones. */
export function buildCrew(variant = 0): CrewRig {
  const root = new Group();
  const skin = SKIN[Math.abs(variant) % SKIN.length];
  const leftLeg = place(limb(0.72, 0.1, "#2c3a52"), 0, 0.92, 0.12);
  const rightLeg = place(limb(0.72, 0.1, "#2c3a52"), 0, 0.92, -0.12);
  const torso = place(new Group(), 0, 0.92, 0);
  torso.add(box(0.3, 0.62, 0.46, solid(VEST, { emissive: VEST, emissiveIntensity: 0.18 }), [0, 0.33, 0]));
  torso.add(box(0.31, 0.06, 0.47, solid("#e9eef5", { emissive: "#ffffff", emissiveIntensity: 0.4 }), [0, 0.42, 0]));
  torso.add(mesh(new SphereGeometry(0.15, 8, 6), solid(skin), [0.02, 0.82, 0]));
  torso.add(mesh(new SphereGeometry(0.17, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2), solid(HAT), [0.02, 0.86, 0]));
  torso.add(mesh(new CylinderGeometry(0.22, 0.22, 0.025, 10), solid(HAT), [0.04, 0.87, 0]));
  const leftArm = place(limb(0.52, 0.075, VEST), 0, 0.6, 0.3);
  const rightArm = place(limb(0.52, 0.075, VEST), 0, 0.6, -0.3);
  torso.add(leftArm, rightArm);
  const tools = { SHOVEL: shovel(), HAMMER: hammer(), SAW: saw() };
  for (const tool of Object.values(tools)) {
    tool.position.set(0, -0.6, 0);
    tool.visible = false;
    rightArm.add(tool);
  }
  root.add(leftLeg, rightLeg, torso);
  return { root, leftArm, rightArm, leftLeg, rightLeg, torso, tools };
}

const POSE_TOOL: Record<CrewPose, CrewTool> = {
  IDLE: "NONE",
  WALK: "NONE",
  SHOVEL: "SHOVEL",
  HAMMER: "HAMMER",
  SAW: "SAW",
  WAVE: "NONE",
};

/** Sets every joint for `pose` at time `t` seconds; pure rotations, so it can run every frame. */
export function poseCrew(rig: CrewRig, pose: CrewPose, t: number): void {
  const tool = POSE_TOOL[pose];
  for (const [name, group] of Object.entries(rig.tools)) group.visible = name === tool;
  rig.torso.rotation.set(0, 0, 0);
  rig.torso.position.y = 0.92;
  rig.leftLeg.rotation.set(0, 0, 0);
  rig.rightLeg.rotation.set(0, 0, 0);
  rig.leftArm.rotation.set(0, 0, 0.08);
  rig.rightArm.rotation.set(0, 0, 0.08);
  const s = Math.sin(t * 2 * Math.PI);
  switch (pose) {
    case "IDLE":
      rig.torso.rotation.z = Math.sin(t * 1.3) * 0.03;
      break;
    case "WALK":
      rig.leftLeg.rotation.z = s * 0.55;
      rig.rightLeg.rotation.z = -s * 0.55;
      rig.leftArm.rotation.z = -s * 0.5;
      rig.rightArm.rotation.z = s * 0.5;
      rig.torso.position.y = 0.92 + Math.abs(s) * 0.04;
      break;
    case "SHOVEL": {
      const dig = (s + 1) / 2;
      rig.torso.rotation.z = -0.25 - dig * 0.35;
      rig.rightArm.rotation.z = 0.5 + dig * 0.7;
      rig.leftArm.rotation.z = 0.4 + dig * 0.6;
      break;
    }
    case "HAMMER":
      rig.torso.rotation.z = -0.35;
      rig.rightArm.rotation.z = 0.9;
      rig.leftArm.rotation.z = 0.9;
      rig.torso.position.y = 0.92 + Math.abs(Math.sin(t * 22)) * 0.025;
      break;
    case "SAW":
      rig.torso.rotation.z = -0.5;
      rig.leftLeg.rotation.z = 0.5;
      rig.rightArm.rotation.z = 0.7 + s * 0.08;
      rig.leftArm.rotation.z = 0.7;
      break;
    case "WAVE":
      rig.rightArm.rotation.x = 2.6 + s * 0.35;
      break;
  }
}
