import type { CharacterSprite } from "./character.ts";

/* A stand-in for any agent without a persona yet: a friendly little service robot with an antenna. */
export const ROBOT: CharacterSprite = {
  palette: { A: "#e0782d", G: "#9aa3ad", g: "#6c757e", E: "#4be37a", D: "#1d1f22", B: "#2f3e56" },
  idle: [
    ".......A........",
    ".......G........",
    "....GGGGGGG.....",
    "....GDEDDED.....",
    "....GDDDDDD.....",
    "....GGGGGGG.....",
    "......gg........",
    "...BBBBBBBBB....",
    "..GBBBGGBBBBG...",
    "..GBBBBBBBBBG...",
    "...BBBBBBBBB....",
    "....gg...gg.....",
    "...GGG...GGG....",
  ],
  work: [
    [
      ".......A........", ".......G........", "....GGGGGGG.....", "....GDEDDED.....", "....GDDDDDD.....",
      "....GGGGGGG.....", "......gg........", "...BBBBBBBBBGG..", "..GBBBGGBBBB....", "..GBBBBBBBBB....",
      "...BBBBBBBBB....", "....gg...gg.....", "...GGG...GGG....",
    ],
    [
      ".......E........", ".......G........", "....GGGGGGG.....", "....GDEDDED.....", "....GDDDDDD.....",
      "....GGGGGGG.....", "......gg........", "...BBBBBBBBB....", "..GBBBGGBBBBGG..", "..GBBBBBBBBB....",
      "...BBBBBBBBB....", "....gg...gg.....", "...GGG...GGG....",
    ],
  ],
  eyes: [[6, 3], [9, 3]],
  lid: "#1d1f22",
};
