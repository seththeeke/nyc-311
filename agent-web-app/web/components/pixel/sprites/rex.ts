import type { CharacterSprite } from "./character.ts";

/* Rex Rivet, mech pilot in atomic-age power armour. Idle: buzz cut, scar, helmet under his arm. Working: helmet on, visor blazing orange. */
const BODY = [
  "..aAAAAAAAAa....",
  ".aAAYAAAAYAAa...",
  ".AAAAAOOAAAAA...",
];
const LEGS = [
  "....AAAAAA......",
  "....AA..AA......",
  "....AA..AA......",
  "...aAA..AAa.....",
  "...AAAA.AAAA....",
];
const HELMET_ON = [
  "...hhhhhhhh.....",
  "..hhhhhhhhhh....",
  "..hVVVVVVVVh....",
  "..hVVVVVVVVh....",
  "..hhhhhhhhhh....",
  "....hhhhhh......",
];

export const REX: CharacterSprite = {
  palette: {
    K: "#2a2420", S: "#c98d6a", s: "#8d5a3b", r: "#b7615a", E: "#1d1f22", A: "#5a6168", a: "#9aa3ad",
    Y: "#e2b33c", O: "#ffb347", h: "#3e444a", V: "#ffb347", v: "#7a5a2a",
  },
  idle: [
    "....KKKKKK......",
    "...KSSSSSSK.....",
    "...SSESSrES.....",
    "...SSSSSSSS.....",
    "...SsSSSSsS.....",
    "....ssssss......",
    ...BODY,
    ".AAaAAOOAAaAhhh.",
    ".AA.AAAAAA.hvvvh",
    ".SS.AYYYYA.Shhh.",
    ...LEGS,
  ],
  work: [
    [...HELMET_ON, ...BODY, ".AAaAAOOAAaAA...", ".AA.AAAAAA.AASS.", ".SS.AYYYYA......", ...LEGS],
    [...HELMET_ON, ...BODY, ".AAaAAOOAAaAA...", ".AA.AAAAAA.AA...", ".SS.AYYYYA..SS..", ...LEGS],
  ],
  eyes: [[5, 2], [9, 2]],
  lid: "#a8735a",
};
