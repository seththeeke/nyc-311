import { CylinderGeometry, type Group, SphereGeometry, TorusGeometry } from "three";
import { box, mesh, solid } from "../../three/threeKit";
import { HEAD_RADIUS, buildFigure, type ResidentRig } from "./residentFigure";
import { HERO } from "./residentPalette";

/*
 * Pine-ter Parker (customer/backend/residents/pineter-parker.json): the
 * friendly neighbourhood hero, in the full suit. A red mask webbed from the
 * centre of the face with big white lenses ringed in black; red chest,
 * arms, gloves and boots; blue sides and legs; a black spider on the chest.
 * The one resident allowed bright colours and an emblem (Appendix P).
 */

const WEB_WIDTH = 0.0045;

/* A thin black ring, for web lines over the mask, arms and boots. */
function webRing(radius: number, segments = 12, arc = Math.PI * 2): ReturnType<typeof mesh> {
  return mesh(new TorusGeometry(radius, WEB_WIDTH, 3, segments, arc), solid(HERO.WEB));
}

/* Lines radiate from the centre of the face (+x) and circle it, like the mask's web. */
function maskWeb(head: Group): void {
  const r = HEAD_RADIUS + 0.004;
  for (let k = 0; k < 5; k++) {
    const line = webRing(r, 16);
    line.rotation.x = (k * Math.PI) / 5;
    head.add(line);
  }
  for (const theta of [0.3, 0.55, 0.85]) {
    const ring = webRing(r * Math.sin(theta), 14);
    ring.position.x = r * Math.cos(theta);
    ring.rotation.y = Math.PI / 2;
    head.add(ring);
  }
}

/* A teardrop lens over each eye, ringed in black, tilted up and out. */
function lenses(head: Group): void {
  for (const side of [1, -1]) {
    const z = side * 0.1;
    const yaw = -side * Math.atan2(0.1, 0.25);
    const rim = mesh(new SphereGeometry(0.08, 8, 5), solid(HERO.WEB), [0.244, 0.055, z]);
    rim.scale.set(0.28, 1.12, 0.82);
    rim.rotation.set(side * 0.45, yaw, 0);
    const lens = mesh(new SphereGeometry(0.068, 8, 5), solid(HERO.LENS), [0.258, 0.055, z]);
    lens.scale.set(0.28, 1.05, 0.7);
    lens.rotation.set(side * 0.45, yaw, 0);
    head.add(rim, lens);
  }
}

/* The chest spider: a body, a head and four legs a side, flat on the front of the suit. */
function spider(torso: Group): void {
  const body = mesh(new SphereGeometry(0.026, 6, 4), solid(HERO.WEB), [0.152, 0.26, 0]);
  body.scale.set(0.5, 1.5, 1);
  torso.add(body, mesh(new SphereGeometry(0.016, 6, 4), solid(HERO.WEB), [0.154, 0.315, 0]));
  for (const side of [1, -1]) {
    for (let i = 0; i < 4; i++) {
      const leg = box(0.008, 0.075, 0.008, solid(HERO.WEB), [0.152, 0.27 - i * 0.012, side * 0.03]);
      leg.rotation.x = side * (0.5 + i * 0.55);
      torso.add(leg);
    }
  }
}

export function buildPineterParker(): ResidentRig {
  const rig = buildFigure({ build: "SLIGHT", height: 1, skin: HERO.RED, brows: HERO.RED, top: HERO.RED, bottom: HERO.BLUE, shoes: HERO.RED });
  /* The mask hides the shared friendly face (eyes, brows, smile): it is the head's second child. */
  rig.head.remove(rig.head.children[1]);
  maskWeb(rig.head);
  lenses(rig.head);
  spider(rig.torso);
  /* Blue down each side of the body, and web rings round the chest and shoulders. */
  for (const side of [1, -1]) rig.torso.add(box(0.2, 0.3, 0.03, solid(HERO.BLUE), [-0.01, 0.16, side * 0.148]));
  for (const [y, radius] of [[0.33, 0.152], [0.2, 0.161]]) {
    const ring = webRing(radius, 14);
    ring.position.y = y;
    ring.rotation.x = Math.PI / 2;
    rig.torso.add(ring);
  }
  /* Web rings down the red arms. */
  for (const arm of [rig.leftArm, rig.rightArm]) {
    for (const y of [-0.08, -0.2, -0.32]) {
      const ring = webRing(0.064, 8);
      ring.position.y = y;
      ring.rotation.x = Math.PI / 2;
      arm.add(ring);
    }
  }
  /* Red boots up the shin over the blue legs. */
  for (const leg of [rig.leftLeg, rig.rightLeg]) {
    leg.add(mesh(new CylinderGeometry(0.082, 0.078, 0.16, 8), solid(HERO.RED), [0, -0.44, 0]));
    const cuff = webRing(0.083, 8);
    cuff.position.y = -0.36;
    cuff.rotation.x = Math.PI / 2;
    leg.add(cuff);
  }
  return rig;
}
