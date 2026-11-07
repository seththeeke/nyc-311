import { CLOTH, FICTION } from "../../../residents/models/residentPalette";
import { buildTeamBody, type TeamRig } from "../kit/teamBody";
import { type Build, dressGrimble } from "./grimbleClothes";
import { dressHead } from "./grimbleHead";
import { GRIMBLE_CYCLE, GRIMBLE_STILL, performGrimble } from "./grimbleMotion";
import { buildScroll, buildTollSign } from "./grimbleProps";

/*
 * Grimble Tollbridge, aws-cost-agent (#146): a reformed bridge troll who
 * once charged every toll there is. Hulking and stooped, two-tone mossy
 * hide, tusks, swept-back ears, a moss cap with a mushroom, spectacles; a
 * linen shirt over a pot belly, a rust waistcoat, a rope belt with coin
 * pouch and bridge keys, ragged trousers, bare feet. On stage the toll
 * scroll is torn in half and the toll drops (grimbleMotion).
 */

const HEAD = 0.27;
const BUILD: Build = { torso: 0.5, shoulder: 0.26, waist: 0.21, hip: 0.17, legs: 0.42 };

export function buildGrimbleTollbridge(): TeamRig {
  const rig = buildTeamBody({
    height: 1.0,
    skin: FICTION.TROLL,
    top: CLOTH.CREAM,
    bottom: CLOTH.OLIVE,
    shoes: FICTION.TROLL,
    hands: FICTION.TROLL,
    head: HEAD,
    shoulder: BUILD.shoulder,
    hip: BUILD.hip,
    waist: BUILD.waist,
    torso: BUILD.torso,
    legs: BUILD.legs,
    arms: 0.6,
    limbs: 0.06,
    handScale: 1.5,
    leftElbow: 0.3,
    rightElbow: 0.3,
    face: { skin: FICTION.TROLL, iris: FICTION.EMBER, brows: FICTION.MOSS, browWeight: 2.8, browLift: 0.1, lid: 0.34, nose: "BULB", mouth: "SET", ears: "ROUND" },
  });
  dressGrimble(rig, BUILD);
  dressHead(rig.head, HEAD);
  rig.torso.rotation.z = -0.12;
  rig.head.rotation.z = 0.16;
  rig.head.position.y -= 0.03;
  const sign = buildTollSign();
  sign.group.position.set(0.1, 0, -0.42);
  rig.root.add(sign.group);
  const scroll = buildScroll();
  rig.root.add(scroll.group);
  rig.animate = performGrimble(rig, scroll, sign);
  rig.cycle = GRIMBLE_CYCLE;
  rig.still = GRIMBLE_STILL;
  return rig;
}
