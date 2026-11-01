import { CylinderGeometry, Group, SphereGeometry } from "three";
import { FACE, FICTION, HAIR, HERO, SKIN } from "../../../residents/models/residentPalette";
import { onHead } from "../kit/teamFace";
import { buildTeamBody, type TeamRig } from "../kit/teamBody";
import { lamp, metal, satin } from "../kit/teamMaterials";
import { ball, lock, part } from "../kit/teamShapes";
import { chest, pauldrons } from "./rexArmor";
import { backpack, belt, legArmour } from "./rexGear";
import { buildHelmet } from "./rexHelmet";
import { REX_CYCLE, REX_STILL, performRex } from "./rexMotion";

/*
 * Rex Rivet, CTO (#146): a veteran mech pilot in atomic-age power
 * armour, helmet tucked under his left arm. Square jaw, stubble, a
 * buzz cut, a scar through one brow and a comms earpiece. On stage he
 * puts the helmet on and strikes a power stance (rexMotion).
 */

const HEAD = 0.23;
const TORSO = 0.46;
const LEGS = 0.52;

function head(rig: TeamRig): void {
  const h = rig.head;
  /* A tight buzz cut: a short crown with a squared hairline, and the back and sides clipped close. */
  const buzz = satin(HAIR.BLACK, { roughness: 1 });
  h.add(part(new SphereGeometry(HEAD + 0.007, 48, 16, 0, Math.PI * 2, 0, Math.PI * 0.34), buzz, [-0.012, 0.0, 0]));
  h.add(part(new SphereGeometry(HEAD + 0.004, 48, 16, -Math.PI * 0.62, Math.PI * 1.24, Math.PI * 0.2, Math.PI * 0.36), buzz));
  for (const side of [1, -1]) h.add(part(ball(0.03, 12, 8), buzz, onHead(HEAD, 0.12, side * 1.25, -0.02), undefined, [0.5, 1.3, 0.3]));
  /* A pale scar through the left brow. */
  h.add(part(lock([onHead(HEAD, 0.44, 0.27, 0.004), onHead(HEAD, 0.33, 0.33, 0.006), onHead(HEAD, 0.2, 0.37, 0.004)], 0.006, 0.003, 6), satin(FACE.BLUSH, { roughness: 0.4 })));
  /* Comms earpiece with a boom mic and a status light, on the right ear. */
  const ear = new Group();
  ear.position.set(-0.01, -0.01, -HEAD * 1.02);
  ear.add(part(new CylinderGeometry(0.035, 0.035, 0.03, 24), metal(FICTION.GUNMETAL, 0.35), [0, 0, 0], [Math.PI / 2, 0, 0]));
  ear.add(part(lock([[0.02, -0.02, -0.012], [0.1, -0.08, 0.0], [0.17, -0.1, 0.04]], 0.006, 0.005, 6), metal(FICTION.GUNMETAL, 0.4)));
  ear.add(part(ball(0.012, 12, 8), metal(FICTION.GUNMETAL, 0.4), [0.17, -0.1, 0.045]));
  ear.add(part(ball(0.006, 8, 6), lamp(HERO.RED, 2), [0.0, 0.02, -0.016]));
  h.add(ear);
}

export function buildRexRivet(): TeamRig {
  const rig = buildTeamBody({
    height: 1.1,
    skin: SKIN.MEDIUM,
    top: FICTION.GUNMETAL,
    bottom: FICTION.GUNMETAL,
    shoes: FICTION.GUNMETAL,
    hands: FICTION.GUNMETAL,
    head: HEAD,
    shoulder: 0.22,
    hip: 0.15,
    waist: 0.16,
    torso: TORSO,
    legs: LEGS,
    arms: 0.48,
    limbs: 0.065,
    handScale: 1.35,
    leftElbow: 1.25,
    face: { skin: SKIN.MEDIUM, iris: FACE.IRIS_GREY, brows: HAIR.BLACK, browWeight: 1.5, browLift: -0.05, lid: 0.36, nose: "STRAIGHT", mouth: "SMIRK" },
  });
  head(rig);
  const reactor = chest(rig, TORSO);
  pauldrons(rig);
  const tip = backpack(rig, TORSO);
  belt(rig);
  legArmour(rig, LEGS + 0.07);
  rig.animate = performRex(rig, buildHelmet(), { reactor, tip });
  rig.cycle = REX_CYCLE;
  rig.still = REX_STILL;
  return rig;
}
