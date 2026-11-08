import type { CharacterSprite } from "./character.ts";

/* Sable Marsh, noir private investigator: pinched fedora, stubble, sand trench coat over a loosened red tie, brass magnifying glass. */
const HEAD = [
  "....FFFFFF......",
  "...FFFFFFFF.....",
  "..FbbbbbbbbF....",
  "FFFFFFFFFFFFFF..",
  "...SSSSSSSS.....",
  "...SSESSSES.....",
  "...SSSSSSSS.....",
  "...ssSSSSss.....",
  "....ssssss......",
];
const COAT = [
  "..CCCWRWCCC.....",
  ".CCCCWRWCCCC....",
  ".CCcCWRWCcCC....",
  ".CCcCCRCCcCC....",
];
const LOWER = [
  "..CcCCCCCCcC....",
  "..CCCCCCCCCC....",
  "..CCC.DD.CCC....",
  "....DD..DD......",
  "....DD..DD......",
  "...KKK..KKK.....",
];

export const SABLE: CharacterSprite = {
  palette: {
    F: "#33363b", b: "#1a1a1e", S: "#f0c8a8", s: "#b8957a", E: "#1d1f22", C: "#b9a888", c: "#9a8a6c",
    W: "#e8e1d3", R: "#c62832", D: "#33363b", K: "#141416", O: "#b38a3c", L: "#c8f0ff",
  },
  idle: [...HEAD, ...COAT, ".SCcCCCCCCcCS...", ...LOWER],
  work: [
    [...HEAD.slice(0, 5), "...SSESSSESOO...", "...SSSSSSSOLLO..", "...ssSSSSssOO...", "....ssssss.S....", ...COAT.slice(0, 3), ".CCcCCRCCcCS....", ".SCcCCCCCCcC....", ...LOWER],
    [...HEAD.slice(0, 5), "...SSESSSES.OO..", "...SSSSSSSSOLLO.", "...ssSSSSss.OO..", "....ssssss..S...", ...COAT.slice(0, 3), ".CCcCCRCCcCCS...", ".SCcCCCCCCcC....", ...LOWER],
  ],
  eyes: [[5, 5], [9, 5]],
  lid: "#c9a080",
};
