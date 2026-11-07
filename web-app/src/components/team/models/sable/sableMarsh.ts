import { CLOTH, DETAIL, FACE, HAIR, SKIN } from "../../../residents/models/residentPalette";
import { buildTeamBody, type TeamRig } from "../kit/teamBody";
import { dressSable } from "./sableCoat";
import { buildFedora, groomSable } from "./sableHead";
import { performSable, SABLE_CYCLE, SABLE_STILL } from "./sableMotion";
import { buildCaseBoard, buildClueCard, buildMagnifier } from "./sableProps";

/*
 * Sable Marsh, software-analyzer-agent (#146): a noir private
 * investigator, an outside hire with no stake in the answer. A sand
 * trench coat over a shirt and loosened tie, charcoal trousers, black
 * oxfords, a pinched fedora, stubble and a brass magnifying glass. On
 * stage he examines a clue, pins it to the case board with red string
 * and tips his hat (sableMotion).
 */

const HEAD = 0.22;
const TORSO = 0.42;
const LEGS = 0.54;

export function buildSableMarsh(): TeamRig {
  const rig = buildTeamBody({
    height: 0.98,
    skin: SKIN.MEDIUM,
    top: CLOTH.SAND,
    bottom: CLOTH.CHARCOAL,
    shoes: DETAIL.SHOE,
    head: HEAD,
    shoulder: 0.175,
    hip: 0.12,
    waist: 0.13,
    torso: TORSO,
    legs: LEGS,
    arms: 0.46,
    limbs: 0.046,
    leftElbow: 0.15,
    rightElbow: 0.15,
    face: { skin: SKIN.MEDIUM, iris: FACE.IRIS_GREY, brows: HAIR.BLACK, browWeight: 1.5, browLift: -0.01, lid: 0.4, nose: "STRAIGHT", mouth: "SMIRK" },
  });
  dressSable(rig, TORSO, LEGS);
  groomSable(rig.head, HEAD);
  const hat = buildFedora(HEAD);
  rig.head.add(hat);
  const magnifier = buildMagnifier();
  rig.rightGrip.add(magnifier.group);
  const card = buildClueCard();
  rig.root.add(card);
  const board = buildCaseBoard();
  board.group.position.set(0.05, 0, 0.55);
  board.group.scale.setScalar(0.82);
  board.group.rotation.y = 0.35;
  rig.root.add(board.group);
  rig.animate = performSable(rig, { hat, lens: magnifier.lens, card, board });
  rig.cycle = SABLE_CYCLE;
  rig.still = SABLE_STILL;
  return rig;
}
