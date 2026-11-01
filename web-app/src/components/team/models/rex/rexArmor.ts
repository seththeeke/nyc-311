import { CylinderGeometry, Group, type MeshStandardMaterial } from "three";
import { CLOTH, FICTION } from "../../../residents/models/residentPalette";
import type { TeamRig } from "../kit/teamBody";
import { glass, lacquer, lamp, metal } from "../kit/teamMaterials";
import { ball, lathe, part, ring, rounded } from "../kit/teamShapes";

/*
 * Rex's power armour above the belt (#146): an olive chest plate with a
 * glowing atomic reactor core, ribbed gunmetal ab plates, a gorget,
 * domed pauldrons with hazard stripes and a stencilled unit number,
 * and heavy bracers. Olive paint over gunmetal, brass rivets.
 */

const PAINT = lacquer(CLOTH.OLIVE, 0.45);
const PLATE = metal(FICTION.GUNMETAL, 0.38);
const BRASS = metal(FICTION.BRASS, 0.25);

function rivets(parent: Group, radius: number, y: number, count: number, from = 0, span = Math.PI * 2): void {
  for (let i = 0; i < count; i++) {
    const a = from + (i / count) * span;
    parent.add(part(ball(0.0075, 8, 6), BRASS, [radius * Math.sin(a), y, radius * Math.cos(a)]));
  }
}

/** The chest and its reactor; returns the reactor's glow so the stage can pulse it. */
export function chest(rig: TeamRig, torso: number): MeshStandardMaterial {
  const shell = new Group();
  shell.scale.set(0.82, 1, 1);
  shell.add(part(lathe([[0.2, torso * 0.42], [0.235, torso * 0.55], [0.245, torso * 0.75], [0.225, torso * 0.92], [0.16, torso * 1.0]], 48), PAINT));
  rivets(shell, 0.236, torso * 0.47, 22);
  for (let i = 0; i < 3; i++) {
    const y = torso * 0.08 + i * 0.05;
    shell.add(part(lathe([[0.19 + i * 0.006, y], [0.2 + i * 0.006, y + 0.02], [0.192 + i * 0.006, y + 0.042]], 40, Math.PI / 2 - 1.1, 2.2), PLATE));
  }
  shell.add(part(ring(0.13, 0.03, Math.PI * 2, 10, 48), PLATE, [0, torso * 0.99, 0]));
  rig.torso.add(shell);
  const core = new Group();
  core.position.set(0.2, torso * 0.68, 0);
  core.rotation.z = -Math.PI / 2;
  core.add(part(lathe([[0.065, -0.01], [0.07, 0.01], [0.062, 0.025], [0.045, 0.03]], 40), BRASS));
  const glow = lamp(FICTION.VISOR, 2.4);
  core.add(part(new CylinderGeometry(0.045, 0.045, 0.02, 40), glow, [0, 0.022, 0]));
  core.add(part(ball(0.046, 32, 12), glass(FICTION.STAR, 0.25), [0, 0.03, 0], undefined, [1, 0.35, 1]));
  for (let i = 0; i < 4; i++) core.add(part(rounded(0.006, 0.006, 0.1, 0.002), PLATE, [0, 0.045, 0], [0, (i * Math.PI) / 4, 0]));
  rig.torso.add(core);
  return glow;
}

export function pauldrons(rig: TeamRig): void {
  for (const [arm, side] of [[rig.leftArm, 1], [rig.rightArm, -1]] as const) {
    const cap = new Group();
    cap.position.set(0, 0.02, side * 0.02);
    cap.add(part(lathe([[0.16, -0.09], [0.165, -0.03], [0.14, 0.04], [0.09, 0.09], [0.001, 0.1]], 40), PAINT));
    cap.add(part(ring(0.162, 0.012, Math.PI * 2, 8, 40), PLATE, [0, -0.09, 0]));
    cap.add(part(lathe([[0.168, -0.06], [0.168, -0.035]], 40, side > 0 ? 0.3 : Math.PI + 0.3, 2.6), lacquer(CLOTH.MUSTARD, 0.4)));
    rivets(cap, 0.163, -0.075, 12);
    if (side > 0) {
      /* The unit number, 07, stencilled on the outside of the left pauldron. */
      const stencil = lacquer(CLOTH.CREAM, 0.5);
      for (const [x, y, w, h, tilt] of [[-0.035, -0.035, 0.008, 0.05, 0], [-0.008, -0.035, 0.008, 0.05, 0], [-0.0215, -0.01, 0.035, 0.008, 0], [-0.0215, -0.06, 0.035, 0.008, 0], [0.022, -0.01, 0.034, 0.008, 0], [0.024, -0.036, 0.008, 0.052, -0.45]]) {
        cap.add(part(rounded(w, h, 0.004, 0.002), stencil, [x, y, 0.166], [0, 0, tilt]));
      }
    }
    arm.add(cap);
    arm.add(part(lathe([[0.075, -0.24], [0.082, -0.12], [0.078, -0.05]], 32), PLATE));
  }
  for (const forearm of [rig.leftForearm, rig.rightForearm]) {
    forearm.add(part(ball(0.075, 20, 14), PLATE, [0, 0, 0]));
    forearm.add(part(lathe([[0.08, -0.26], [0.095, -0.2], [0.095, -0.08], [0.08, -0.03]], 32), PAINT));
    forearm.add(part(ring(0.096, 0.008, Math.PI * 2, 8, 32), BRASS, [0, -0.14, 0]));
    forearm.add(part(rounded(0.04, 0.05, 0.06, 0.01), PLATE, [0.09, -0.16, 0]));
    forearm.add(part(ball(0.008, 8, 6), lamp(FICTION.HOLO, 2), [0.112, -0.15, 0.012]));
  }
}
