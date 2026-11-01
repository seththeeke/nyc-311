/*
 * The only colours a resident model may use (13-customer-simulation.md §2
 * customer side, decision 3; style guide in Appendix P). Muted on
 * purpose, so a page of avatars stays calm. This is the one file under
 * models/ allowed to hold a colour literal; lint rejects them elsewhere.
 */

export const SKIN = {
  LIGHT: "#f0c8a8",
  MEDIUM: "#c98d6a",
  TAN: "#8d5a3b",
  DEEP: "#5e3b28",
} as const;

export const HAIR = {
  BLACK: "#2a2420",
  BROWN: "#5a3d2b",
  AUBURN: "#7a3b22",
  GREY: "#a9a9a3",
} as const;

export const CLOTH = {
  CREAM: "#e8e1d3",
  SLATE: "#4b5563",
  NAVY: "#2f3e56",
  OLIVE: "#5b6146",
  TEAL: "#4f7c7a",
  RUST: "#8a4b34",
  CHARCOAL: "#33363b",
  DENIM: "#3f5675",
  SAND: "#b9a888",
  /* Yellowwood's safety vest: school-bus yellow, toned down. */
  MUSTARD: "#b8963e",
} as const;

export const DETAIL = {
  EYE: "#1d1f22",
  /* Eye whites: Mii-style eyes read on every skin tone. */
  EYE_WHITE: "#f4f1ea",
  LENS: "#9fb2c4",
  SHOE: "#26282c",
  /* The one bright note: a cyclist's reflective strip. Kept small. */
  REFLECTIVE: "#d6e27a",
  STEEL: "#9aa3ad",
} as const;

/*
 * The one exception to "muted" (Appendix P): Pine-ter Parker's suit,
 * which only reads as the suit in full red and blue.
 */
export const HERO = {
  RED: "#c62832",
  BLUE: "#2a4fa8",
  WEB: "#16171a",
  LENS: "#f5f7fa",
} as const;

/*
 * The executive team's fiction cast (#146): a typewriter mascot, a dwarf,
 * an oracle, a leprechaun, a mech pilot, a gnome and a sidekick. Each
 * character only reads in its own colours, so these are brighter than
 * the residents' (like HERO).
 */
export const FICTION = {
  TYPEWRITER: "#3f7f86",
  KEY: "#f1ead8",
  BRASS: "#b38a3c",
  HOLO: "#7fe3e0",
  GLOVE: "#f7f5ef",
  LEATHER: "#6e4a2f",
  GINGER: "#b4562a",
  SHAMROCK: "#3d7a3a",
  GOLD: "#e2b33c",
  ROBE: "#3a2f6b",
  STAR: "#e9d27a",
  CRYSTAL: "#a9d8f5",
  GUNMETAL: "#5a6168",
  VISOR: "#ffb347",
  GNOME_HAT: "#a8382e",
  SIDEKICK: "#2b8fb3",
  EMBER: "#e0782d",
  BEARD: "#e6e2d8",
} as const;

/* Faces at the executives' higher detail: irises, lips, blush and the catchlight in each eye. */
export const FACE = {
  IRIS_BROWN: "#6b4423",
  IRIS_GREEN: "#4f8a4b",
  IRIS_VIOLET: "#7b5fb3",
  IRIS_BLUE: "#4a7fb5",
  IRIS_GREY: "#7c8794",
  LIP: "#b7615a",
  BLUSH: "#e39a8c",
  CATCHLIGHT: "#ffffff",
} as const;

/* Studio lighting for the avatar snapshot. */
export const LIGHT = {
  SKY: "#ffffff",
  GROUND: "#8a8f98",
  KEY: "#fff6ea",
  /* The executives' studio (#146): a cool fill and a warm rim behind them. */
  FILL: "#cfe0ff",
  RIM: "#ffd9a8",
} as const;

/** Every colour a model may put on a material, for the palette test. */
export const MODEL_COLOURS: readonly string[] = [SKIN, HAIR, CLOTH, DETAIL, HERO, FICTION, FACE].flatMap((group) => Object.values(group));
