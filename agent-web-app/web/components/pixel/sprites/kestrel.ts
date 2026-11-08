import type { CharacterSprite } from "./character.ts";

/* Kid Kestrel, superhero sidekick: spiky bangs and a high ponytail, domino mask, sky-blue suit, ember gloves, boots and cape, gold utility belt. */
const HEAD = [
  "...KKKKKK.......",
  "..KKKKKKKKKK....",
  "..KSSSSSSKKK....",
  "..MMWMMWMM.KK...",
  "..SSSSSSSS..K...",
  "...SSSSSS.......",
];
const LOWER = [
  "..YYYYYYYYY.....",
  "..BBBB.BBBB.....",
  "..BBBB.BBBB.....",
  "..RRRR.RRRR.....",
  ".RRRRR.RRRRR....",
];

export const KESTREL: CharacterSprite = {
  palette: { K: "#2a2420", S: "#f0c8a8", M: "#1d1f22", W: "#f7f5ef", B: "#2b8fb3", R: "#e0782d", Y: "#e2b33c", T: "#26282c", G: "#4be37a" },
  idle: [...HEAD, "RRBBBBBBBRR.....", "RRRBBYYBBRRR....", "RRBBBBYBBBBR....", "RRBBBBBBBBBR....", ...LOWER],
  work: [
    [...HEAD, "RRBBBBBBBRR.....", "RRRBBYYBBRRRTTT.", "RRBBBBYBBBBRTGT.", "RRBBBBBBBBBRTTT.", ...LOWER],
    [...HEAD, "RRBBBBBBBRR.....", "RRRBBYYBBRRRTTT.", "RRBBBBYBBBBRTTT.", "RRBBBBBBBBBRTGT.", ...LOWER],
  ],
  eyes: [[4, 3], [7, 3]],
  lid: "#1d1f22",
};
