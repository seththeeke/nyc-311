import { Group } from "three";
import { CLOTH, FACE, FICTION, HAIR, SKIN } from "../../../residents/models/residentPalette";
import { buildTeamBody, type TeamRig } from "../kit/teamBody";
import { lacquer, metal, satin } from "../kit/teamMaterials";
import { lathe, part, ring, rounded, tube } from "../kit/teamShapes";
import { buildBeard, buildHat } from "./pipHead";
import { PIP_CYCLE, PIP_STILL, performPip } from "./pipMotion";
import { buildStopwatch, buildWrench, pocketTools } from "./pipTools";

/*
 * Pip Sprocketwhistle, devx-agent (#146): a gnome tinkerer. Tiny, in a
 * denim work shirt with the sleeves rolled, a leather apron full of
 * tools, a tool belt and brown trousers. Red pointed hat with goggles,
 * a big white beard, a stopwatch on a chain and an oversized wrench. On
 * stage he cranks a stuck gear free (pipMotion).
 */

const HEAD = 0.27;
const TORSO = 0.36;
const LEGS = 0.3;

function workwear(rig: TeamRig): void {
  const leather = satin(FICTION.LEATHER, { roughness: 0.55, doubleSided: true });
  const apron = new Group();
  apron.scale.set(0.78, 1, 1);
  apron.add(part(lathe([[0.2, -0.24], [0.18, -0.1], [0.16, 0.06], [0.15, 0.24], [0.13, TORSO * 0.85]], 24, Math.PI / 2 - 0.55, 1.1), leather));
  apron.add(part(lathe([[0.205, -0.12], [0.19, -0.02]], 12, Math.PI / 2 - 0.42, 0.84), leather));
  const tools = pocketTools();
  tools.position.set(0.19, -0.08, 0);
  apron.add(tools);
  rig.torso.add(apron);
  for (const side of [1, -1]) rig.torso.add(part(tube([[0.1, TORSO * 0.85, side * 0.08], [0.02, TORSO * 1.0, side * 0.1], [-0.12, TORSO * 0.7, side * 0.06]], 0.008, 6), satin(FICTION.LEATHER)));
  const belt = new Group();
  belt.scale.set(0.78, 1, 1);
  belt.add(part(ring(0.175, 0.022, Math.PI * 2, 8, 48), lacquer(HAIR.BROWN, 0.5), [0, 0.02, 0], undefined, [1, 1.4, 1]));
  for (const a of [0.9, 2.0, -0.9, -2.0]) belt.add(part(rounded(0.05, 0.06, 0.04, 0.01), lacquer(FICTION.LEATHER, 0.5), [0.18 * Math.cos(a), 0.0, 0.18 * Math.sin(a)], [0, -a, 0]));
  belt.add(part(rounded(0.02, 0.04, 0.05, 0.006), metal(FICTION.BRASS, 0.2), [0.18, 0.02, 0]));
  rig.torso.add(belt);
  /* Sleeves rolled to the elbow, and bare forearms. */
  for (const forearm of [rig.leftForearm, rig.rightForearm]) {
    forearm.add(part(ring(0.05, 0.02, Math.PI * 2, 8, 24), satin(CLOTH.DENIM, { roughness: 0.7 }), [0, -0.01, 0]));
    forearm.add(part(lathe([[0.043, -0.17], [0.05, -0.08], [0.047, -0.02]], 24), satin(SKIN.LIGHT, { roughness: 0.55 })));
  }
  for (const leg of [rig.leftLeg, rig.rightLeg]) leg.add(part(ring(0.06, 0.012, Math.PI * 2, 6, 24), satin(HAIR.BROWN), [0, -LEGS + 0.02, 0]));
}

export function buildPipSprocketwhistle(): TeamRig {
  const rig = buildTeamBody({
    height: 0.74,
    skin: SKIN.LIGHT,
    top: CLOTH.DENIM,
    bottom: HAIR.BROWN,
    shoes: FICTION.LEATHER,
    head: HEAD,
    shoulder: 0.16,
    hip: 0.13,
    waist: 0.15,
    torso: TORSO,
    legs: LEGS,
    arms: 0.34,
    limbs: 0.045,
    handScale: 1.1,
    leftElbow: 0.1,
    face: { skin: SKIN.LIGHT, iris: FACE.IRIS_BLUE, brows: FICTION.BEARD, browWeight: 2, browLift: 0.08, lid: 0.22, nose: "BULB", mouth: "SMILE", ears: "POINTED", blush: true },
  });
  workwear(rig);
  buildBeard(rig.head, HEAD);
  const { hat, goggles } = buildHat(HEAD);
  rig.head.add(hat, goggles);
  const watch = buildStopwatch();
  watch.group.position.set(0.2, TORSO * 0.55, -0.07);
  watch.group.rotation.y = 0.35;
  rig.torso.add(watch.group);
  rig.torso.add(part(tube([[0.08, TORSO * 0.98, 0.07], [0.17, TORSO * 0.8, 0.02], [0.2, TORSO * 0.62, -0.06]], 0.003, 6), metal(FICTION.GOLD, 0.25)));
  rig.animate = performPip(rig, goggles, buildWrench(), watch);
  rig.cycle = PIP_CYCLE;
  rig.still = PIP_STILL;
  return rig;
}
