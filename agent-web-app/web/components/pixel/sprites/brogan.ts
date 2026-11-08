import type { CharacterSprite } from "./character.ts";

/* Brogan Anvilhand, dwarf foreman: steel helm, braided ginger beard, chainmail over a rust tunic, leather jerkin, a knotwork buckle. The war-hammer is drawn by his room. */
const HEAD = [
  "....mMMMMm......",
  "...mMMMMMMm.....",
  "..MMMMMMMMMM....",
  "..MmmmmmmmmM....",
  "...SSSSSSSS.....",
  "...SESSSSES.....",
  "...SSSNNSSS.....",
  "..GGGSSSSGGG....",
  ".GGGGGGGGGGGG...",
  ".LGGGGGGGGGGL...",
];
const BODY = [
  "SLCCCGgGgCCCLS..",
  ".LRRRCGGCRRRL...",
  ".BBBBBYYBBBBB...",
  ".LRRRRRRRRRRL...",
  "..RRRR..RRRR....",
  "..KKKK..KKKK....",
  ".KKKKK..KKKKK...",
];

export const BROGAN: CharacterSprite = {
  palette: {
    M: "#9aa3ad", m: "#6c757e", S: "#c98d6a", E: "#1d1f22", N: "#a8604a", G: "#b4562a", g: "#7e3a18",
    L: "#6e4a2f", C: "#7c8794", R: "#8a4b34", B: "#26282c", Y: "#e2b33c", K: "#33363b",
  },
  idle: [...HEAD, "LLCGGgGGgGGCLL..", ...BODY],
  work: [
    [...HEAD, "LLCGGgGGgGGCLLSS", ...BODY],
    [...HEAD, "LLCGGgGGgGGCLL..", "SLCCCGgGgCCCLSS.", ...BODY.slice(1)],
  ],
  eyes: [[4, 5], [9, 5]],
  lid: "#a8735a",
};
