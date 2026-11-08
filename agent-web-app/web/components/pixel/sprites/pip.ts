import type { CharacterSprite } from "./character.ts";

/* Pip Sprocketwhistle, gnome tinkerer: red pointed hat, brass goggles, big white beard, denim shirt, leather apron, oversized wrench. */
const HEAD = [
  "......HH........",
  ".....HHh........",
  "....HHHh........",
  "....HHHHh.......",
  "...HHHHHHh......",
  "..HHHHHHHHh.....",
  "..GGLLGGLLGG....",
  "...SSSSSSSS.....",
  "...SSSESSSE.....",
  "...SSSSSSNN.....",
  "...WWSSSSWW.....",
  "..WWWWWWWWWW....",
  "..WWWWWWWWWw....",
  "..DWWWWWWWwD....",
];
const LEGS = [
  "...AAAAAAAA.....",
  "...TTT..TTT.....",
  "...TTT..TTT.....",
  "..BBBB..BBBB....",
];

export const PIP: CharacterSprite = {
  palette: {
    H: "#a8382e", h: "#7a2620", G: "#b38a3c", L: "#9fe0f0", S: "#f0c8a8", N: "#e39a8c", E: "#1d1f22",
    W: "#e6e2d8", w: "#c8c2b4", D: "#3f5675", A: "#6e4a2f", T: "#5a3d2b", B: "#26282c", M: "#c4ccd4",
  },
  idle: [...HEAD, ".DDAWWWWWwADD...", ".SDAAAAAAAADS...", "..DAAAMAAAAD....", ...LEGS],
  work: [
    [...HEAD, ".DDAWWWWWwADDSMM", ".SDAAAAAAAADD.MM", "..DAAAMAAAAD..M.", ...LEGS],
    [...HEAD, ".DDAWWWWWwADD...", ".SDAAAAAAAADDSM.", "..DAAAMAAAAD.MMM", ...LEGS],
  ],
  eyes: [[6, 8], [10, 8]],
  lid: "#c98d6a",
};
