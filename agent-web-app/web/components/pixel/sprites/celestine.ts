import type { CharacterSprite } from "./character.ts";

/* Celestine Vey, the Oracle: long black hair, gold circlet with a crescent crystal, a midnight robe sewn with stars. Seated; the table hides her legs. */
const HEAD = [
  ".....KKKKKK.....",
  "....KOOCCOOK....",
  "...KKSSSSSSKK...",
  "...KSSESSESSK...",
  "...KSSSSSSSSK...",
  "...KKSSPPSSKK...",
  "..KKKKSSSSKKKK..",
  "..KRRRRRRRRRRK..",
  ".KRRR*RRRR*RRRK.",
];
const ROBE = [
  "..RRRRRRRRRRRR..",
  "..RR*RRRRRRR*R..",
  ".RRRRRRR*RRRRRR.",
  ".RrRRR*RRRRRrRR.",
  "RRRRRRRRRRRRRRRR",
];

export const CELESTINE: CharacterSprite = {
  palette: {
    K: "#1e1a24", O: "#e2b33c", C: "#a9d8f5", S: "#c98d6a", E: "#2a2140", P: "#b7615a",
    R: "#3a2f6b", r: "#2a2150", "*": "#e9d27a",
  },
  idle: [...HEAD, ".KRRRRRRRRRRRRK.", ...ROBE.slice(0, 4), "RRRRSSRRRRSSRRRR"],
  work: [
    [...HEAD, "SKRRRRRRRRRRRRKS", "SSRRRRRRRRRRRRSS", ...ROBE.slice(1)],
    [...HEAD, ".KRRRRRRRRRRRRK.", "..SSRRRRRRRRSS..", ".RSSRRR*RRRSSRR.", ...ROBE.slice(2)],
  ],
  eyes: [[6, 3], [9, 3]],
  lid: "#a8735a",
};
