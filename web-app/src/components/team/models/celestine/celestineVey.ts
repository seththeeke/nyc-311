import { Group, Quaternion, SphereGeometry, Vector3 } from "three";
import { FACE, FICTION, HAIR, SKIN } from "../../../residents/models/residentPalette";
import { onHead } from "../kit/teamFace";
import { buildTeamBody, type TeamRig } from "../kit/teamBody";
import { lamp, metal, satin } from "../kit/teamMaterials";
import { extrude, part, ring, tube, type Vec3 } from "../kit/teamShapes";
import { buildCrystalBall } from "./crystalBall";
import { CELESTINE_CYCLE, CELESTINE_STILL, performCelestine } from "./celestineMotion";
import { buildHood, buildMantle, buildSkirt, buildSleeve, crescentShape, starShape } from "./celestineRobe";

/*
 * Celestine Vey, CPO (#146): the Oracle. Tall and slender in a midnight
 * robe sewn with stars, the hood thrown back over long black hair, a gold
 * circlet with a crescent-moon crystal, hoops and bangles, and the
 * crystal ball held up on one palm, lighting her face from below. On
 * stage it rises into a vision (celestineMotion).
 */

const HEAD = 0.235;
const TORSO = 0.43;
const LEGS = 0.52;
const HAIR_SATIN = satin(HAIR.BLACK, { roughness: 0.4 });

function hair(head: Group): void {
  head.add(part(new SphereGeometry(HEAD + 0.012, 40, 20, 0, Math.PI * 2, 0, Math.PI * 0.42), HAIR_SATIN, [-0.008, 0.006, 0]));
  head.add(part(new SphereGeometry(HEAD + 0.01, 40, 24, -Math.PI * 0.6, Math.PI * 1.2, Math.PI * 0.2, Math.PI * 0.62), HAIR_SATIN, [-0.02, 0, 0]));
  /* A centre parting sweeping down each side, and long strands over the shoulders. */
  for (const side of [1, -1]) {
    for (let i = 0; i < 4; i++) {
      const across = side * (0.55 + i * 0.22);
      const start = onHead(HEAD, 0.55 - i * 0.05, across, 0.01);
      const path: Vec3[] = [start, onHead(HEAD, 0.05, side * (0.9 + i * 0.2), 0.03), [-0.02 - i * 0.04, -HEAD * 1.0, side * (HEAD * 0.95 + 0.02)], [0.02 - i * 0.05, -HEAD * 1.9, side * (HEAD * 0.75)]];
      head.add(part(tube(path, 0.032 - i * 0.003, 10), HAIR_SATIN));
    }
  }
}

function circlet(head: Group): void {
  const band = part(ring(HEAD + 0.014, 0.006, Math.PI * 2, 8, 64), metal(FICTION.GOLD, 0.2), [0, 0.07, 0], [0, 0, -0.32]);
  head.add(band);
  const jewel = part(extrude(crescentShape(0.03), 0.008, 0.002), lamp(FICTION.CRYSTAL, 1.2), onHead(HEAD, 0.42, 0, 0.012), [0, 0, 0.42]);
  head.add(jewel);
  head.add(part(extrude(starShape(0.012), 0.004, 0.001), metal(FICTION.STAR, 0.2), onHead(HEAD, 0.48, 0.06, 0.018), [0, 0, 0.48]));
  for (const side of [1, -1]) {
    head.add(part(ring(0.024, 0.0035, Math.PI * 2, 6, 24), metal(FICTION.GOLD, 0.2), [-0.01, -0.09, side * (HEAD * 0.98)], [Math.PI / 2, 0, 0]));
  }
}

/* Sits `item` upright, `lift` above the palm in world terms, however the hand is turned. */
function restAbovePalm(rig: TeamRig, item: Group, lift: number): void {
  rig.root.updateMatrixWorld(true);
  const palm = rig.leftHand.localToWorld(new Vector3(0, -0.045, 0));
  palm.y += lift * rig.root.scale.y;
  item.position.copy(rig.leftHand.worldToLocal(palm));
  item.quaternion.copy(rig.leftHand.getWorldQuaternion(new Quaternion()).invert());
}

export function buildCelestineVey(): TeamRig {
  const rig = buildTeamBody({
    height: 1.04,
    skin: SKIN.TAN,
    top: FICTION.ROBE,
    bottom: FICTION.ROBE,
    shoes: FICTION.ROBE,
    head: HEAD,
    shoulder: 0.17,
    hip: 0.12,
    waist: 0.11,
    torso: TORSO,
    legs: LEGS,
    arms: 0.47,
    limbs: 0.046,
    leftElbow: 1.25,
    face: { skin: SKIN.TAN, iris: FACE.IRIS_VIOLET, brows: HAIR.BLACK, browWeight: 0.8, browLift: 0.05, lid: 0.44, lashes: true, nose: "STRAIGHT", mouth: "SMIRK" },
  });
  const hipY = LEGS + 0.07;
  rig.torso.add(buildSkirt(0.1, -hipY + 0.005));
  rig.torso.add(buildMantle(TORSO, 0.17));
  rig.torso.add(part(extrude(crescentShape(0.045), 0.006, 0.002), metal(FICTION.STAR, 0.3), [0.115, TORSO * 0.62, 0], [0, 0, 0]));
  for (const forearm of [rig.leftForearm, rig.rightForearm]) forearm.add(buildSleeve(0.2));
  for (let i = 0; i < 3; i++) rig.rightHand.add(part(ring(0.04, 0.005, Math.PI * 2, 6, 24), metal(FICTION.GOLD, 0.2), [0, 0.03 + i * 0.012, 0]));
  hair(rig.head);
  circlet(rig.head);
  const hood = buildHood(HEAD);
  rig.head.add(hood);
  /* Palm up under the orb. */
  rig.leftHand.rotation.y = -Math.PI / 2;
  const orb = buildCrystalBall(0.1);
  rig.leftHand.add(orb.group);
  restAbovePalm(rig, orb.group, 0.12);
  rig.animate = performCelestine(rig, orb);
  rig.cycle = CELESTINE_CYCLE;
  rig.still = CELESTINE_STILL;
  return rig;
}
