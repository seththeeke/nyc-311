// Validated data-encoding colors for the ingestion-metrics dashboard only —
// see dataviz skill's references/palette.md for the source instance and
// scripts/validate_palette.js for the pass/fail run. Light-mode values only:
// the rest of the app has no dark-mode support anywhere (fixed light
// chrome throughout), so a dark-aware chart here would be inconsistent,
// not more accessible — same reasoning that keeps this file scoped to
// data-encoding colors only, never page chrome (that stays on the
// existing Tailwind slate tokens the rest of the app already uses).
//
// Categorical slots 1–3 (blue/orange/aqua): validated all-pairs distinguishable
// in both CVD simulation and normal vision (worst pair CVD ΔE 9.2, normal-vision
// ΔE 24.0 — both clear the skill's floors). Status good/critical: the skill's
// fixed, never-themed status scale.
export const IV_COLORS = {
  seriesIngested: "#2a78d6", // blue — slot 1
  seriesDuplicates: "#eb6834", // orange — slot 2
  seriesRejected: "#1baf7a", // aqua — slot 3
  statusGood: "#0ca30c",
  statusWarning: "#fab219",
  statusCritical: "#d03b3b",
  sparklineTrack: "#c3c2b7", // de-emphasis / muted — palette.md's mode-invariant muted token
} as const;
