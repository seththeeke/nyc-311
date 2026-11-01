import { Group } from "three";
import { CLOTH, DETAIL, FACE, FICTION, HAIR, SKIN } from "../../../residents/models/residentPalette";
import { buildTeamBody, heightAboveFloor, type TeamRig } from "../kit/teamBody";
import { lacquer, metal } from "../kit/teamMaterials";
import { ball, lathe, part, ring, rounded } from "../kit/teamShapes";
import { buildBeard } from "./broganBeard";
import { apron, furCollar, legs } from "./broganClothes";
import { buildHammer, buildHelm, buildLantern } from "./broganGear";
import { BROGAN_CYCLE, BROGAN_STILL, performBrogan } from "./broganMotion";

/*
 * Brogan Anvilhand, COO (#146): a dwarf foreman of the old deep crews.
 * Short and barrel-chested in a rust wool tunic under a chainmail shirt
 * and an open leather jerkin, a broad belt with a knotwork buckle, a
 * leather apron, bracers and steel-capped boots. Helm, braided beard,
 * a war-hammer planted at his side and a lantern on the belt. On stage
 * he swings the hammer down on the stone (broganMotion).
 */

const HEAD = 0.27;
const TORSO = 0.44;
const SHOULDER = 0.25;
const WAIST = 0.21;

/* Profile of a shell over the torso, `pad` out from the body, between two heights. */
function shell(pad: number, from: number, to: number): [number, number][] {
  const points: [number, number][] = [];
  for (let i = 0; i <= 8; i++) {
    const y = from + ((to - from) * i) / 8;
    const k = y / TORSO;
    const r = k < 0.45 ? 0.17 + (WAIST - 0.17) * (k / 0.45) : WAIST + (SHOULDER * 0.86 - WAIST) * Math.min(1, (k - 0.45) / 0.29);
    points.push([r + pad, y]);
  }
  return points;
}

function dress(rig: TeamRig): void {
  const mail = metal(DETAIL.STEEL, 0.5);
  rig.torso.add(part(lathe(shell(0.012, 0.02, TORSO * 0.86), 48), mail, [0, 0, 0], undefined, [0.72, 1, 1]));
  for (let i = 0; i < 12; i++) {
    const y = 0.04 + i * 0.028;
    const r = shell(0.016, y, y)[0][0];
    rig.torso.add(part(ring(r, 0.004, Math.PI * 2, 4, 48), mail, [0, y, 0], undefined, [0.72, 1, 1]));
  }
  const leather = lacquer(FICTION.LEATHER, 0.55);
  rig.torso.add(part(lathe(shell(0.03, 0.05, TORSO * 0.9), 40, Math.PI / 2 + 0.55, Math.PI * 2 - 1.1), leather, [0, 0, 0], undefined, [0.72, 1, 1]));
  /* Belt, buckle, apron and the roster scroll in its pocket. */
  rig.torso.add(part(ring(0.2, 0.035, Math.PI * 2, 10, 48), lacquer(HAIR.BROWN, 0.5), [0, 0.06, 0], undefined, [0.75, 1.5, 1.04]));
  const buckle = new Group();
  buckle.position.set(0.16, 0.06, 0);
  buckle.add(part(rounded(0.03, 0.1, 0.12, 0.012), metal(FICTION.BRASS, 0.22)));
  buckle.add(part(ring(0.032, 0.007, Math.PI * 2, 8, 32), metal(FICTION.GOLD, 0.2), [0.017, 0, 0], [0, 0, Math.PI / 2]));
  buckle.add(part(ring(0.016, 0.006, Math.PI * 2, 8, 24), metal(FICTION.GOLD, 0.2), [0.02, 0, 0], [0, 0, Math.PI / 2]));
  rig.torso.add(buckle);
  for (const forearm of [rig.leftForearm, rig.rightForearm]) {
    forearm.add(part(lathe([[0.085, -0.22], [0.08, -0.12], [0.072, -0.04]], 24), leather));
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      forearm.add(part(ball(0.009, 8, 6), metal(FICTION.BRASS, 0.2), [Math.cos(a) * 0.084, -0.17, Math.sin(a) * 0.084]));
    }
  }
  for (const arm of [rig.leftArm, rig.rightArm]) {
    arm.add(part(lathe([[0.125, -0.06], [0.12, 0.0], [0.09, 0.06], [0.001, 0.085]], 28), leather));
  }
  apron(rig);
  legs(rig, 0.43);
  furCollar(rig, TORSO);
}

export function buildBroganAnvilhand(): TeamRig {
  const rig = buildTeamBody({
    height: 0.9,
    skin: SKIN.LIGHT,
    top: CLOTH.RUST,
    bottom: CLOTH.SLATE,
    shoes: FICTION.LEATHER,
    head: HEAD,
    shoulder: SHOULDER,
    hip: 0.17,
    waist: WAIST,
    torso: TORSO,
    legs: 0.36,
    arms: 0.42,
    limbs: 0.07,
    handScale: 1.25,
    leftElbow: 0.04,
    face: { skin: SKIN.LIGHT, iris: FACE.IRIS_BLUE, brows: HAIR.AUBURN, browWeight: 1.8, browLift: -0.1, lid: 0.36, nose: "BULB", mouth: "SET", blush: true },
  });
  dress(rig);
  buildBeard(rig.head, HEAD);
  const helm = buildHelm(HEAD);
  helm.position.y = 0.05;
  rig.head.add(helm);
  const drop = heightAboveFloor(rig, rig.leftGrip) - 0.01;
  const hammer = buildHammer(drop);
  const lantern = buildLantern();
  lantern.group.position.set(0.02, -0.04, -0.2);
  rig.torso.add(lantern.group);
  rig.animate = performBrogan(rig, hammer, drop, lantern.flame);
  rig.cycle = BROGAN_CYCLE;
  rig.still = BROGAN_STILL;
  return rig;
}
