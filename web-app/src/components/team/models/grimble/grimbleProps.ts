import { CylinderGeometry, Group, Shape } from "three";
import { DETAIL, FICTION, HAIR, HERO } from "../../../residents/models/residentPalette";
import { lacquer, metal, satin } from "../kit/teamMaterials";
import { extrude, lathe, part, ring, rounded, tube } from "../kit/teamShapes";

/*
 * Grimble's props (#146): the toll scroll, which unrolls from a turned
 * wooden roller under a red wax seal and tears in half; and the toll
 * sign, a carved board swinging from a bracket on two chains, with the
 * day's stack of gold coins on a little shelf below.
 */

export const SCROLL_LENGTH = 0.62;
const SCROLL_WIDTH = 0.28;
const PARCHMENT = satin(FICTION.KEY, { roughness: 0.85 });
const INK = satin(DETAIL.EYE, { roughness: 0.9 });
const WOOD = lacquer(HAIR.BROWN, 0.5);
const BRASS = metal(FICTION.BRASS, 0.22);

/** One half of the scroll's parchment, hanging down from y = 0, ruled with toll entries and their prices. */
function sheet(length: number, entries: number): Group {
  const group = new Group();
  group.add(part(rounded(0.005, length, SCROLL_WIDTH, 0.0025, 2), PARCHMENT, [0, -length / 2, 0]));
  for (let i = 0; i < entries; i++) {
    const y = -0.035 - i * (length / (entries + 0.4));
    group.add(part(rounded(0.002, 0.006, SCROLL_WIDTH * (0.4 + ((i * 0.37) % 0.25)), 0.001), INK, [0.0035, y, -0.035]));
    group.add(part(rounded(0.002, 0.006, 0.035, 0.001), INK, [0.0035, y, SCROLL_WIDTH * 0.36]));
    group.add(part(rounded(0.0015, 0.0015, SCROLL_WIDTH * 0.85, 0.0005), satin(FICTION.LEATHER, { roughness: 0.9 }), [0.003, y - 0.014, 0]));
  }
  return group;
}

function roller(): Group {
  const group = new Group();
  const turned = lathe([[0.016, -SCROLL_WIDTH / 2 - 0.01], [0.018, -SCROLL_WIDTH / 2 + 0.02], [0.016, 0], [0.018, SCROLL_WIDTH / 2 - 0.02], [0.016, SCROLL_WIDTH / 2 + 0.01]], 24);
  group.add(part(turned, WOOD, [0, 0, 0], [Math.PI / 2, 0, 0]));
  for (const side of [1, -1]) {
    const knob = lathe([[0.012, 0], [0.026, 0.008], [0.024, 0.02], [0.012, 0.03], [0.004, 0.036]], 24);
    group.add(part(knob, BRASS, [0, 0, side * (SCROLL_WIDTH / 2 + 0.008)], [side * (Math.PI / 2), 0, 0]));
  }
  return group;
}

export interface TollScroll {
  /* On the figure's root, placed at the hand each frame, facing +x. */
  group: Group;
  /* The kept top half and the bottom half that tears away, each scaled down y to unroll. */
  top: Group;
  bottom: Group;
}

export function buildScroll(): TollScroll {
  const group = new Group();
  group.add(roller());
  const seal = new Group();
  seal.position.set(0.01, -0.02, 0.09);
  seal.add(part(new CylinderGeometry(0.02, 0.022, 0.008, 20), lacquer(HERO.RED, 0.3), [0, 0, 0], [0, 0, Math.PI / 2]));
  seal.add(part(ring(0.012, 0.0025, Math.PI * 2, 6, 20), lacquer(HERO.RED, 0.3), [0.005, 0, 0], [0, 0, Math.PI / 2]));
  for (const z of [-0.008, 0.008]) seal.add(part(tube([[0, -0.015, z], [0.002, -0.045, z * 2], [0.002, -0.07, z * 1.5]], 0.003, 6), lacquer(HERO.RED, 0.4)));
  group.add(seal);
  const top = new Group();
  top.add(sheet(SCROLL_LENGTH / 2, 6));
  const bottom = new Group();
  bottom.add(sheet(SCROLL_LENGTH / 2, 6));
  const end = roller();
  end.position.y = -SCROLL_LENGTH / 2;
  bottom.add(end);
  group.add(top, bottom);
  return { group, top, bottom };
}

/** A gold coin lying flat, with a milled rim. */
function coin(): Group {
  const group = new Group();
  group.add(part(lathe([[0.001, -0.007], [0.038, -0.007], [0.04, -0.004], [0.04, 0.004], [0.038, 0.007], [0.001, 0.007]], 32), metal(FICTION.GOLD, 0.18)));
  group.add(part(ring(0.03, 0.0025, Math.PI * 2, 6, 28), metal(FICTION.STAR, 0.2), [0, 0.0075, 0]));
  return group;
}

export const TOLL_COINS = 9;
/* The stack's bottom coin height on the shelf, and the step up to each next coin. */
export const COIN_BASE = 0.567;
export const COIN_STEP = 0.0145;

export interface TollSign {
  group: Group;
  /* The stack on the sign's shelf, bottom first: the top ones pop off when the toll drops. */
  coins: Group[];
}

function chain(group: Group, from: [number, number, number], links: number): void {
  for (let i = 0; i < links; i++) group.add(part(ring(0.009, 0.0025, Math.PI * 2, 6, 16), metal(DETAIL.STEEL, 0.35), [from[0], from[1] - i * 0.016, from[2]], [i % 2 ? Math.PI / 2 : 0, 0, Math.PI / 2]));
}

/** The toll sign: a turned post with a bracket arm, a carved board hung on chains, and a shelf of coins. */
export function buildTollSign(): TollSign {
  const group = new Group();
  group.add(part(lathe([[0.07, 0], [0.065, 0.03], [0.04, 0.06], [0.034, 0.5], [0.038, 1.05], [0.045, 1.08], [0.02, 1.12], [0.001, 1.13]], 24), WOOD));
  group.add(part(rounded(0.04, 0.035, 0.36, 0.01), WOOD, [0.0, 1.0, -0.16]));
  group.add(part(tube([[0, 0.86, -0.02], [0, 0.93, -0.09], [0, 0.99, -0.16]], 0.012, 8), WOOD));
  const board = new Group();
  board.position.set(0.0, 0.84, -0.2);
  for (const z of [-0.14, 0.14]) chain(board, [0, 0.14, z], 4);
  const plank = new Shape();
  plank.moveTo(-0.17, -0.07);
  plank.lineTo(0.17, -0.07);
  plank.lineTo(0.17, 0.05);
  plank.quadraticCurveTo(0, 0.1, -0.17, 0.05);
  plank.closePath();
  board.add(part(extrude(plank, 0.024, 0.006), lacquer(FICTION.LEATHER, 0.45), [-0.012, 0, 0]));
  board.add(part(rounded(0.0015, 0.0015, 0.3, 0.0005), satin(HAIR.BROWN), [0.0175, -0.012, 0]));
  const arch = new Shape();
  arch.moveTo(-0.11, 0);
  arch.absarc(0, 0, 0.11, Math.PI, 0, true);
  arch.lineTo(0.08, 0);
  arch.absarc(0, 0, 0.08, 0, Math.PI, false);
  arch.closePath();
  board.add(part(extrude(arch, 0.008, 0.002), BRASS, [0.018, -0.045, 0]));
  board.add(part(rounded(0.008, 0.012, 0.26, 0.003), BRASS, [0.022, -0.048, 0]));
  for (let i = 0; i < 5; i++) board.add(part(rounded(0.004, 0.004, 0.03, 0.002), satin(FICTION.SIDEKICK), [0.022, -0.062, -0.1 + i * 0.05]));
  group.add(board);
  group.add(part(rounded(0.12, 0.018, 0.14, 0.006), WOOD, [0.07, 0.55, 0]));
  group.add(part(tube([[0.02, 0.48, 0], [0.08, 0.53, 0]], 0.008, 6), WOOD));
  const coins: Group[] = [];
  for (let i = 0; i < TOLL_COINS; i++) {
    const piece = coin();
    piece.position.set(0.075 + ((i * 0.37) % 0.008), COIN_BASE + i * COIN_STEP, ((i * 0.61) % 0.01) - 0.005);
    piece.rotation.set(((i * 0.7) % 0.06) - 0.03, i * 0.7, 0);
    group.add(piece);
    coins.push(piece);
  }
  return { group, coins };
}
