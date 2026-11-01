import { Group, SphereGeometry } from "three";
import { FACE, FICTION, HAIR, SKIN } from "../../../residents/models/residentPalette";
import { onHead } from "../kit/teamFace";
import { buildTeamBody, type TeamRig } from "../kit/teamBody";
import { lacquer, lamp, metal, satin } from "../kit/teamMaterials";
import { lock, part, ring, rounded, type Vec3 } from "../kit/teamShapes";
import { KESTREL_CYCLE, KESTREL_STILL, performKestrel } from "./kestrelMotion";
import { belt, cape, emblem, gloves, mask } from "./kestrelSuit";

/*
 * Kid Kestrel, gen-purpose-dev (#146): a superhero sidekick, still
 * earning the cape. Sky-blue suit with ember gloves, boots and cape, a
 * domino mask, a kestrel emblem, a gold utility belt, spiky bangs and a
 * high ponytail, and a tablet showing a freshly merged PR. On stage she
 * backflips into a superhero landing (kestrelMotion).
 */

const HEAD = 0.23;
const TORSO = 0.4;
const LEGS = 0.52;
const HAIR_SATIN = satin(HAIR.BLACK, { roughness: 0.45 });

function hair(head: Group): void {
  head.add(part(new SphereGeometry(HEAD + 0.012, 48, 20, 0, Math.PI * 2, 0, Math.PI * 0.4), HAIR_SATIN, [-0.012, 0.004, 0]));
  head.add(part(new SphereGeometry(HEAD + 0.01, 48, 20, -Math.PI * 0.6, Math.PI * 1.2, Math.PI * 0.25, Math.PI * 0.35), HAIR_SATIN));
  /* Spiky bangs swept to one side. */
  for (let i = 0; i < 7; i++) {
    const across = -0.55 + i * 0.17;
    const start = onHead(HEAD, 0.75, across * 0.6, 0.0);
    const end = onHead(HEAD, 0.36 - (i % 2) * 0.05, across + 0.18, 0.035);
    head.add(part(lock([start, onHead(HEAD, 0.6, across * 0.8 + 0.08, 0.04), end], 0.04, 0.006, 10), HAIR_SATIN));
  }
  /* The ponytail, high at the back, with an ember tie. */
  const root: Vec3 = [-HEAD * 0.82, HEAD * 0.45, 0];
  head.add(part(ring(0.035, 0.012, Math.PI * 2, 8, 24), lacquer(FICTION.EMBER, 0.4), root, [0, 0, 1.1]));
  for (let k = 0; k < 3; k++) {
    const z = (k - 1) * 0.022;
    head.add(part(lock([root, [-HEAD * 1.2, HEAD * 0.3, z], [-HEAD * 1.35, -HEAD * 0.2, z * 1.6], [-HEAD * 1.25, -HEAD * 0.75, z * 2]], 0.04 - k * 0.006, 0.008, 12), HAIR_SATIN));
  }
}

/* A tablet showing a merged pull request: an ember tick on a glowing screen. */
function tablet(): Group {
  const slate = new Group();
  slate.position.set(0.02, -0.07, -0.02);
  slate.rotation.set(0, 0, 0.15);
  slate.add(part(rounded(0.16, 0.22, 0.014, 0.012), metal(FICTION.GUNMETAL, 0.35)));
  slate.add(part(rounded(0.14, 0.19, 0.004, 0.006), lamp(FICTION.HOLO, 0.9), [0, 0, -0.008]));
  for (const [x, y, w, a] of [[-0.018, -0.005, 0.04, 0.8], [0.018, 0.012, 0.075, -0.9]]) {
    slate.add(part(rounded(w, 0.012, 0.003, 0.004), lamp(FICTION.EMBER, 1.6), [x, y, -0.011], [0, 0, a]));
  }
  return slate;
}

export function buildKidKestrel(): TeamRig {
  const rig = buildTeamBody({
    height: 0.96,
    skin: SKIN.TAN,
    top: FICTION.SIDEKICK,
    bottom: FICTION.SIDEKICK,
    shoes: FICTION.EMBER,
    hands: FICTION.EMBER,
    head: HEAD,
    shoulder: 0.16,
    hip: 0.12,
    waist: 0.11,
    torso: TORSO,
    legs: LEGS,
    arms: 0.45,
    limbs: 0.045,
    leftElbow: 0.9,
    face: { skin: SKIN.TAN, iris: FACE.IRIS_BROWN, brows: HAIR.BLACK, browWeight: 1, browLift: 0.08, lid: 0.2, lashes: true, nose: "BUTTON", mouth: "GRIN", blush: true },
  });
  hair(rig.head);
  mask(rig.head, HEAD);
  emblem(rig, TORSO);
  belt(rig);
  gloves(rig, LEGS + 0.07);
  const flap = cape(rig, TORSO);
  rig.leftGrip.add(tablet());
  rig.animate = performKestrel(rig, flap);
  rig.cycle = KESTREL_CYCLE;
  rig.still = KESTREL_STILL;
  return rig;
}
