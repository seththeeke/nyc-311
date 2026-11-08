import type { CharacterSprite } from "./character.ts";

/* Grimble Tollbridge, reformed bridge troll: mossy hide, a moss cap with a red mushroom, brass spectacles, tusks, linen shirt, rust waistcoat, rope belt and coin pouch. */
const HEAD = [
  ".....RRwR.......",
  "....MMMMMMM.....",
  "...MMMMMMMMM....",
  "TT.TTTTTTTTT.TT.",
  ".TTTOOLTTOOLTT..",
  "..TTOELTTOELT...",
  "..TTTTTllTTTT...",
  "..TUTTTllTTUT...",
  "..TUTTTTTTTUT...",
  "...TTTTTTTTT....",
  "..CCCVVCCVVCCC..",
];
const LOWER = [
  "..YYYYYYYPYYYY..",
  "..DDDDDDDPPDDD..",
  "..DDDDD..DDDDD..",
  "..DDDD....DDDD..",
  ".TTTTT....TTTTT.",
];

export const GRIMBLE: CharacterSprite = {
  palette: {
    R: "#c62832", w: "#f7f5ef", M: "#4e6b34", T: "#7d8c5c", l: "#a3ae80", O: "#b38a3c", L: "#c8dce8",
    E: "#1d1f22", U: "#f1ead8", C: "#e8e1d3", V: "#8a4b34", Y: "#b8963e", P: "#6e4a2f", D: "#5b6146", g: "#e2b33c",
  },
  idle: [...HEAD, ".TCCCVVCCVVCCCT.", "TTCCVVCCCCVVCCTT", "TTCCCCCCCCCCCCTT", "T.CCCCCCCCCCCC.T", ...LOWER],
  work: [
    [...HEAD, ".TCCCVVCCVVCCCTg", "TTCCVVCCCCVVCCTT", "TTCCCCCCCCCCCC.T", "T.CCCCCCCCCCCC..", ...LOWER],
    [...HEAD, ".TCCCVVCCVVCCCT.", "TTCCVVCCCCVVCCTg", "TTCCCCCCCCCCCCTT", "T.CCCCCCCCCCCC.T", ...LOWER],
  ],
  eyes: [[5, 5], [10, 5]],
  lid: "#5f6d44",
};
