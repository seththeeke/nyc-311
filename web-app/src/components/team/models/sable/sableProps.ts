import { type BufferAttribute, CylinderGeometry, Group, type Mesh } from "three";
import { CLOTH, DETAIL, FICTION, HAIR, HERO } from "../../../residents/models/residentPalette";
import { glass, lacquer, metal, satin } from "../kit/teamMaterials";
import { ball, part, ring, rounded, tube, type Vec3 } from "../kit/teamShapes";

/*
 * Sable's props (#146): a brass magnifying glass, a clue card, and the
 * case board: a corkboard on an easel with cards pinned up and red string
 * between them, and one empty slot waiting for the new clue.
 */

const CARD = satin(CLOTH.CREAM, { roughness: 0.75 });
const INK = satin(DETAIL.EYE, { roughness: 0.9 });
const PIN = lacquer(HERO.RED, 0.3);

/** The magnifying glass, hanging from the grip: handle at the fist, lens beyond it down -y. */
export function buildMagnifier(): { group: Group; lens: Group } {
  const group = new Group();
  group.add(part(new CylinderGeometry(0.014, 0.017, 0.11, 16), lacquer(FICTION.LEATHER, 0.45), [0, -0.02, 0]));
  group.add(part(new CylinderGeometry(0.019, 0.019, 0.016, 16), metal(FICTION.BRASS, 0.25), [0, -0.082, 0]));
  const lens = new Group();
  lens.position.set(0, -0.15, 0);
  lens.add(part(ring(0.06, 0.008, Math.PI * 2, 8, 40), metal(FICTION.BRASS, 0.2), [0, 0, 0], [0, 0, Math.PI / 2]));
  lens.add(part(new CylinderGeometry(0.057, 0.057, 0.006, 40), glass(FICTION.CRYSTAL, 0.35), [0, 0, 0], [0, 0, Math.PI / 2]));
  group.add(lens);
  return { group, lens };
}

/** A clue: a cream card with a photo square and a line of notes, facing +x. */
export function buildClueCard(photo: string = CLOTH.SAND): Group {
  const group = new Group();
  group.add(part(rounded(0.004, 0.09, 0.12, 0.002), CARD));
  group.add(part(rounded(0.002, 0.045, 0.05, 0.001), satin(photo, { roughness: 0.6 }), [0.003, 0.012, -0.025]));
  for (let i = 0; i < 3; i++) group.add(part(rounded(0.002, 0.006, 0.04 - i * 0.008, 0.001), INK, [0.003, 0.02 - i * 0.014, 0.03]));
  group.add(part(ball(0.009, 12, 8), PIN, [0.008, 0.038, 0]));
  return group;
}

export interface CaseBoard {
  group: Group;
  /* Where the new clue is pinned, as an anchor to carry the card to. */
  slot: Group;
  /* The string drawn from the new clue to the case's centre card; reveal it with `drawString`. */
  string: Mesh;
}

/* Board space: the cork faces +x, centred at the origin, z across and y up. */
const CARDS: Vec3[] = [[0.02, 0.1, -0.16], [0.02, -0.08, -0.08], [0.02, 0.06, 0.04]];
const SLOT: Vec3 = [0.02, -0.07, 0.17];

function string(from: Vec3, to: Vec3): Mesh {
  const mid: Vec3 = [from[0] + 0.012, (from[1] + to[1]) / 2 - 0.02, (from[2] + to[2]) / 2];
  return part(tube([from, mid, to], 0.0025, 6), lacquer(HERO.RED, 0.4));
}

export function buildCaseBoard(): CaseBoard {
  const group = new Group();
  const wood = lacquer(HAIR.BROWN, 0.55);
  const board = new Group();
  board.position.y = 0.92;
  board.add(part(rounded(0.03, 0.44, 0.6, 0.01), wood));
  board.add(part(rounded(0.012, 0.4, 0.56, 0.004), satin(FICTION.CORK, { roughness: 0.95 }), [0.012, 0, 0]));
  CARDS.forEach((at, i) => {
    const card = buildClueCard(i === 1 ? CLOTH.SLATE : CLOTH.SAND);
    card.position.set(...at);
    card.rotation.x = (i - 1) * 0.12;
    board.add(card);
  });
  board.add(string([0.03, 0.135, -0.16], [0.03, -0.045, -0.08]), string([0.03, -0.045, -0.08], [0.03, 0.095, 0.04]));
  for (const [y, z, a] of [[0.13, 0.17, 0.1], [-0.12, -0.2, -0.15], [0.15, -0.02, 0.05]] as const) {
    board.add(part(rounded(0.003, 0.055, 0.055, 0.002), satin(CLOTH.MUSTARD, { roughness: 0.8 }), [0.02, y, z], [a, 0, 0]));
    board.add(part(rounded(0.002, 0.004, 0.035, 0.001), INK, [0.023, y + 0.008, z], [a, 0, 0]));
  }
  const photo = new Group();
  photo.position.set(0.02, -0.11, 0.06);
  photo.rotation.x = -0.12;
  photo.add(part(rounded(0.004, 0.1, 0.085, 0.002), satin(CLOTH.CREAM, { roughness: 0.6 })));
  photo.add(part(rounded(0.002, 0.07, 0.07, 0.001), satin(CLOTH.SLATE, { roughness: 0.4 }), [0.003, 0.008, 0]));
  photo.add(part(ball(0.008, 12, 8), PIN, [0.008, 0.045, 0]));
  board.add(photo);
  const drawn = string([0.03, -0.035, 0.17], [0.03, 0.095, 0.04]);
  board.add(drawn);
  const slot = new Group();
  slot.position.set(...SLOT);
  board.add(slot);
  for (const side of [1, -1]) {
    group.add(part(new CylinderGeometry(0.013, 0.016, 1.12, 12), wood, [-0.04, 0.53, side * 0.24], [side * 0.1, 0, -0.08]));
  }
  group.add(part(new CylinderGeometry(0.012, 0.014, 1.05, 12), wood, [-0.2, 0.5, 0], [0, 0, 0.32]));
  group.add(part(rounded(0.06, 0.016, 0.62, 0.006), wood, [0.02, 0.69, 0]));
  group.add(part(rounded(0.012, 0.014, 0.5, 0.004), wood, [-0.07, 0.3, 0], [0, 0, -0.08]));
  group.add(part(new CylinderGeometry(0.007, 0.007, 0.08, 10), satin(CLOTH.CREAM), [0.035, 0.705, 0.12], [Math.PI / 2, 0, 0.2]));
  group.add(board);
  return { group, slot, string: drawn };
}

/** Shows `k` of the drawn string, 0 to 1, from the new clue outwards. */
export function drawString(mesh: Mesh, k: number): void {
  /* A tube is always indexed, so its index count is the whole string. */
  const total = (mesh.geometry.index as BufferAttribute).count;
  mesh.visible = k > 0.001;
  mesh.geometry.setDrawRange(0, Math.floor((total * Math.min(1, Math.max(0, k))) / 6) * 6);
}
