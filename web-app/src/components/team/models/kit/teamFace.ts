import { CapsuleGeometry, ConeGeometry, Group, SphereGeometry } from "three";
import { DETAIL, FACE } from "../../../residents/models/residentPalette";
import { lamp, satin } from "./teamMaterials";
import { ball, part, tube, type Vec3 } from "./teamShapes";

/*
 * A face at the executives' detail (#146): eyeballs with an iris, pupil
 * and catchlight, eyelids that set the mood, brows, a nose, a mouth and
 * ears, all placed on the head sphere by angle so they follow its curve.
 */

export interface FaceStyle {
  skin: string;
  iris: string;
  brows: string;
  /* Brow thickness and lift: a scowl is thick and low, surprise thin and high. */
  browWeight?: number;
  browLift?: number;
  /* How far the upper lids come down, 0.2 (wide awake) to 0.5 (knowing). */
  lid?: number;
  lashes?: boolean;
  nose?: "BUTTON" | "BULB" | "STRAIGHT";
  mouth?: "SMILE" | "GRIN" | "SMIRK" | "SET";
  ears?: "ROUND" | "POINTED";
  lips?: string;
  blush?: boolean;
}

/** A point on a head of `radius` facing +x: `up` and `across` are angles, `lift` stands off the skin. */
export function onHead(radius: number, up: number, across: number, lift = 0): Vec3 {
  const r = radius + lift;
  return [r * Math.cos(up) * Math.cos(across), r * Math.sin(up), r * Math.cos(up) * Math.sin(across)];
}

function eye(radius: number, style: FaceStyle, side: number): Group {
  const e = radius * 0.17;
  const group = new Group();
  group.position.set(...onHead(radius, 0.08, side * 0.36, -e * 0.45));
  group.rotation.set(0, -side * 0.36, 0.08);
  group.add(part(ball(e, 24, 16), satin(DETAIL.EYE_WHITE, { roughness: 0.25 })));
  group.add(part(ball(e * 0.6, 20, 14), satin(style.iris, { roughness: 0.3 }), [e * 0.84, 0, 0], undefined, [0.3, 1, 1]));
  group.add(part(ball(e * 0.32, 16, 10), satin(DETAIL.EYE, { roughness: 0.15 }), [e * 0.95, 0, 0], undefined, [0.3, 1, 1]));
  group.add(part(ball(e * 0.11, 8, 6), lamp(FACE.CATCHLIGHT, 2), [e * 1.0, e * 0.26, -side * e * 0.2]));
  /* The upper lid: a cap of skin over the top of the eyeball, tipped forward. */
  const cover = Math.PI * (style.lid ?? 0.3);
  const lid = part(new SphereGeometry(e * 1.1, 24, 10, 0, Math.PI * 2, 0, cover), satin(style.skin), [0, 0, 0], [0, 0, -0.35]);
  group.add(lid);
  if (style.lashes) {
    for (let i = 0; i < 3; i++) {
      const lash = part(new CapsuleGeometry(e * 0.05, e * 0.35, 2, 4), satin(DETAIL.EYE), [e * 0.55, e * 0.95, side * e * (0.35 + i * 0.25)]);
      lash.rotation.set(side * (0.5 + i * 0.25), 0, -0.6);
      group.add(lash);
    }
  }
  return group;
}

function brow(radius: number, style: FaceStyle, side: number): ReturnType<typeof part> {
  const up = 0.36 + (style.browLift ?? 0);
  const points: Vec3[] = [0.16, 0.34, 0.54].map((across, i) => onHead(radius, up + (i === 1 ? 0.05 : 0) - (i === 0 ? 0.02 : 0), side * across, 0.012));
  return part(tube(points, radius * 0.03 * (style.browWeight ?? 1), 8), satin(style.brows, { roughness: 0.9 }));
}

function nose(radius: number, style: FaceStyle, group: Group): void {
  const kind = style.nose ?? "BUTTON";
  const skin = satin(style.skin);
  if (kind === "BULB") {
    group.add(part(ball(radius * 0.17), skin, onHead(radius, -0.12, 0, 0.05)));
    for (const side of [1, -1]) group.add(part(ball(radius * 0.08), skin, onHead(radius, -0.2, side * 0.13, 0.02)));
    return;
  }
  if (kind === "STRAIGHT") {
    group.add(part(new CapsuleGeometry(radius * 0.05, radius * 0.18, 4, 12), skin, onHead(radius, -0.04, 0, 0.02), [0, 0, 0.25]));
  }
  group.add(part(ball(radius * (kind === "STRAIGHT" ? 0.075 : 0.1)), skin, onHead(radius, -0.13, 0, 0.03)));
}

function mouth(radius: number, style: FaceStyle, group: Group): void {
  const kind = style.mouth ?? "SMILE";
  const curve = kind === "SET" ? 0 : kind === "GRIN" ? 0.09 : 0.06;
  const widths = kind === "GRIN" ? 0.3 : 0.24;
  const points: Vec3[] = [-1, -0.5, 0, 0.5, 1].map((t) => {
    const smirk = kind === "SMIRK" ? t * 0.04 : 0;
    return onHead(radius, -0.36 - curve * (1 - t * t) + curve * 0.4 + smirk, t * widths, 0.004);
  });
  group.add(part(tube(points, radius * 0.022, 8), satin(style.lips ?? FACE.LIP, { roughness: 0.4 })));
  if (kind === "GRIN") {
    const teeth = part(ball(radius * 0.2, 20, 10), satin(DETAIL.EYE_WHITE, { roughness: 0.3 }), onHead(radius, -0.4, 0, -0.035), undefined, [0.3, 0.32, 1]);
    group.add(teeth);
  }
  if (style.blush) {
    for (const side of [1, -1]) group.add(part(ball(radius * 0.11, 16, 10), satin(FACE.BLUSH, { opacity: 0.55 }), onHead(radius, -0.16, side * 0.5, -0.01), [0, -side * 0.5, 0], [0.3, 0.8, 1]));
  }
}

function ears(radius: number, style: FaceStyle, group: Group): void {
  const skin = satin(style.skin);
  for (const side of [1, -1]) {
    if (style.ears === "POINTED") {
      const tip = part(new ConeGeometry(radius * 0.12, radius * 0.55, 16), skin, [-radius * 0.05, radius * 0.12, side * radius * 1.0], [side * -0.9, 0, 0.3], [0.5, 1, 1]);
      group.add(tip);
    }
    group.add(part(ball(radius * 0.16, 16, 12), skin, [-radius * 0.04, -radius * 0.02, side * radius * 0.96], undefined, [0.55, 1, 0.4]));
    group.add(part(ball(radius * 0.09, 12, 8), satin(FACE.LIP, { roughness: 0.8 }), [-radius * 0.02, -radius * 0.02, side * radius * 1.02], undefined, [0.5, 0.9, 0.2]));
  }
}

/** The whole face, as one group to add to a head of `radius`. */
export function buildFace(radius: number, style: FaceStyle): Group {
  const group = new Group();
  for (const side of [1, -1]) group.add(eye(radius, style, side), brow(radius, style, side));
  nose(radius, style, group);
  mouth(radius, style, group);
  ears(radius, style, group);
  return group;
}
