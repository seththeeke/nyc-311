import type { CharacterSprite } from "./character.ts";

/* Penny Platen, 1950s cartoon typewriter mascot: teal body, cream keys, big cartoon eyes, rubber-hose arms, white gloves, red Mary Janes. */
const BODY = [
  "......PPPP......",
  "......PPPP......",
  "..CCCCCCCCCCCC..",
  "..CTTTTTTTTTTC..",
  "..TTWWTTTTWWTT..",
  "..TTWETTTTWETT..",
  "..TTTTTTTTTTTT..",
  "..TTTTRRRRTTTT..",
  "..TTTTTTTTTTTT..",
  ".tKtKtKtKtKtKtK.",
  ".tttttttttttttt.",
];
const FEET = [
  "....B......B....",
  "....B......B....",
  "...MM......MM...",
];

export const PENNY: CharacterSprite = {
  palette: {
    P: "#ffffff", C: "#26282c", T: "#3f7f86", t: "#2c5a60", W: "#f7f5ef", E: "#1d1f22",
    R: "#b7615a", K: "#f1ead8", B: "#1d1f22", G: "#f7f5ef", M: "#c62832",
  },
  idle: [...BODY, "B..............B", "G..............G", ...FEET],
  work: [
    [...BODY.slice(0, 9), "GtKtKtKtKtKtKtKG", "BttttttttttttttB", "................", "................", ...FEET],
    [...BODY.slice(0, 9), ".tKtGtKtKtGtKtK.", ".ttBttttttBtttt.", "................", "................", ...FEET],
  ],
  eyes: [[4, 5], [5, 5], [10, 5], [11, 5]],
  lid: "#3f7f86",
};
