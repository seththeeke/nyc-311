import { ConeGeometry, Group } from "three";
import { CLOTH, DETAIL, FACE, FICTION, SKIN } from "../../../residents/models/residentPalette";
import { buildTeamBody, type TeamRig } from "../kit/teamBody";
import { lacquer, metal, satin } from "../kit/teamMaterials";
import { ball, lathe, part, ring, rounded, tube } from "../kit/teamShapes";
import { buildHat, buildWhiskers } from "./fergusHead";
import { FERGUS_CYCLE, FERGUS_STILL, performFergus } from "./fergusMotion";
import { buildPotOfGold } from "./potOfGold";

/*
 * Fergus Farthing, CFO (#146): a leprechaun. Short and round in a green
 * tailcoat over a gold waistcoat with a watch chain, white collar and
 * black bow tie, green breeches, white stockings and buckled shoes. Tall
 * buckled hat, ginger mutton chops, a ledger under one hand and the pot
 * of gold at his feet. On stage he flips a coin and clicks his heels
 * (fergusMotion).
 */

const HEAD = 0.27;
const TORSO = 0.4;
const LEGS = 0.36;
const HIP_Y = LEGS + 0.07;

function coat(rig: TeamRig): void {
  const felt = satin(FICTION.SHAMROCK, { roughness: 0.6, doubleSided: true });
  const shell: [number, number][] = [[0.18, -0.02], [0.19, 0.1], [0.185, 0.2], [0.18, 0.3], [0.16, TORSO * 0.95]];
  const front = new Group();
  front.scale.set(0.78, 1, 1);
  front.add(part(lathe(shell, 48, Math.PI / 2 + 0.6, Math.PI * 2 - 1.2), felt));
  /* The two tails, split at the back and falling to the knee. */
  for (const side of [1, -1]) {
    const start = side > 0 ? Math.PI * 1.5 + 0.05 : Math.PI * 1.5 - 0.62;
    front.add(part(lathe([[0.215, -0.32], [0.2, -0.16], [0.185, -0.02]], 12, start, 0.57), felt));
  }
  front.add(part(ring(0.19, 0.012, Math.PI * 2, 8, 48), metal(FICTION.GOLD, 0.25), [0, -0.01, 0]));
  rig.torso.add(front);
  /* Waistcoat belly, its buttons and the watch chain. */
  rig.torso.add(part(ball(0.17, 32, 24), satin(CLOTH.MUSTARD, { roughness: 0.45 }), [0.03, 0.15, 0], undefined, [0.85, 1.1, 0.95]));
  for (let i = 0; i < 4; i++) rig.torso.add(part(ball(0.011, 12, 8), metal(FICTION.GOLD, 0.2), [0.177 - Math.abs(i - 1.5) * 0.008, 0.06 + i * 0.055, 0]));
  rig.torso.add(part(tube([[0.17, 0.13, 0.0], [0.175, 0.1, 0.05], [0.16, 0.12, 0.1]], 0.004, 6), metal(FICTION.GOLD, 0.2)));
  for (const side of [1, -1]) {
    const lapel = part(rounded(0.01, 0.19, 0.075, 0.005), lacquer(FICTION.SHAMROCK, 0.5), [0.128, 0.27, side * 0.09], [side * 0.28, side * 0.55, -0.12]);
    rig.torso.add(lapel);
    rig.torso.add(part(new ConeGeometry(0.03, 0.06, 4), satin(CLOTH.CREAM, { roughness: 0.5 }), [0.09, TORSO + 0.01, side * 0.035], [side * 0.6, 0, -1.9]));
    rig.torso.add(part(ball(0.03, 16, 12), satin(DETAIL.EYE, { roughness: 0.4 }), [0.11, TORSO - 0.02, side * 0.03], [0, 0, 0], [0.5, 0.75, 1.1]));
  }
  rig.torso.add(part(ball(0.013, 12, 8), satin(DETAIL.EYE, { roughness: 0.4 }), [0.12, TORSO - 0.02, 0]));
  for (const arm of [rig.leftArm, rig.rightArm]) arm.add(part(lathe([[0.085, -0.07], [0.085, 0.0], [0.065, 0.05], [0.001, 0.07]], 32), lacquer(FICTION.SHAMROCK, 0.55)));
  for (const forearm of [rig.leftForearm, rig.rightForearm]) {
    forearm.add(part(lathe([[0.062, -0.2], [0.064, -0.15], [0.058, -0.13]], 24), lacquer(FICTION.SHAMROCK, 0.5)));
    forearm.add(part(ring(0.05, 0.012, Math.PI * 2, 8, 24), satin(CLOTH.CREAM), [0, -0.205, 0]));
    forearm.add(part(ball(0.009, 10, 8), metal(FICTION.GOLD, 0.2), [0.06, -0.175, 0]));
  }
}

function legs(rig: TeamRig): void {
  for (const leg of [rig.leftLeg, rig.rightLeg]) {
    leg.add(part(lathe([[0.075, 0.03], [0.1, -0.06], [0.1, -0.14], [0.085, -0.19]], 28), satin(FICTION.SHAMROCK, { roughness: 0.6 })));
    leg.add(part(ball(0.01, 10, 8), metal(FICTION.GOLD, 0.2), [0.07, -0.18, 0.04]));
    leg.add(part(lathe([[0.072, -0.19], [0.07, -0.26], [0.062, -HIP_Y + 0.09]], 24), satin(CLOTH.CREAM, { roughness: 0.75 })));
    const buckle = new Group();
    buckle.position.set(0.105, -HIP_Y + 0.075, 0);
    buckle.rotation.z = -0.5;
    const gold = metal(FICTION.GOLD, 0.18);
    for (const [y, z, h, w] of [[0.022, 0, 0.01, 0.07], [-0.022, 0, 0.01, 0.07], [0, 0.03, 0.054, 0.01], [0, -0.03, 0.054, 0.01]]) {
      buckle.add(part(rounded(0.01, h, w, 0.003), gold, [0, y, z]));
    }
    leg.add(buckle);
  }
}

/** A green leather ledger with gold corners, held by its spine. */
function ledger(): Group {
  const book = new Group();
  book.position.set(0.0, -0.06, 0.0);
  book.add(part(rounded(0.17, 0.22, 0.045, 0.008), lacquer(FICTION.LEATHER, 0.45)));
  book.add(part(rounded(0.16, 0.205, 0.034, 0.004), satin(CLOTH.CREAM, { roughness: 0.85 }), [0.008, 0, 0]));
  for (const [x, y] of [[0.08, 0.105], [0.08, -0.105], [-0.08, 0.105], [-0.08, -0.105]]) book.add(part(rounded(0.025, 0.025, 0.05, 0.004), metal(FICTION.GOLD, 0.2), [x, y, 0]));
  book.add(part(rounded(0.06, 0.04, 0.047, 0.003), metal(FICTION.GOLD, 0.25), [0, 0.03, 0]));
  return book;
}

export function buildFergusFarthing(): TeamRig {
  const rig = buildTeamBody({
    height: 0.82,
    skin: SKIN.LIGHT,
    top: FICTION.SHAMROCK,
    bottom: FICTION.SHAMROCK,
    shoes: DETAIL.EYE,
    head: HEAD,
    shoulder: 0.18,
    hip: 0.15,
    waist: 0.17,
    torso: TORSO,
    legs: LEGS,
    arms: 0.38,
    limbs: 0.05,
    leftElbow: 0.5,
    face: { skin: SKIN.LIGHT, iris: FACE.IRIS_GREEN, brows: FICTION.GINGER, browWeight: 1.6, browLift: 0.06, lid: 0.26, nose: "BUTTON", mouth: "GRIN", ears: "POINTED", blush: true },
  });
  coat(rig);
  legs(rig);
  buildWhiskers(rig.head, HEAD);
  const hat = buildHat();
  hat.position.set(-0.01, HEAD * 0.6, 0);
  hat.rotation.set(0.14, 0, -0.1);
  rig.head.add(hat);
  rig.leftGrip.add(ledger());
  const pot = buildPotOfGold();
  pot.group.position.set(0.08, 0, -0.36);
  rig.root.add(pot.group);
  rig.animate = performFergus(rig, pot);
  rig.cycle = FERGUS_CYCLE;
  rig.still = FERGUS_STILL;
  return rig;
}
