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

/* Studio lighting for the avatar snapshot. */
export const LIGHT = {
  SKY: "#ffffff",
  GROUND: "#8a8f98",
  KEY: "#fff6ea",
} as const;

/** Every colour a model may put on a material, for the palette test. */
export const MODEL_COLOURS: readonly string[] = [SKIN, HAIR, CLOTH, DETAIL].flatMap((group) => Object.values(group));
