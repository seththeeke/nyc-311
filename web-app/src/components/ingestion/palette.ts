/*
 * Validated data-encoding colors for the ingestion-metrics dashboard only
 * (dataviz skill's references/palette.md, validated via
 * scripts/validate_palette.js). Light-mode only — the app has no dark
 * mode, so a dark-aware chart would be inconsistent, not more accessible.
 * Scoped to data-encoding colors; page chrome stays on the app's existing
 * Tailwind slate tokens. Categorical slots 1-3 validated
 * all-pairs-distinguishable (CVD ΔE 9.2, normal-vision ΔE 24.0).
 */
export const IV_COLORS = {
  seriesIngested: "#2a78d6", /* blue — slot 1 */
  seriesDuplicates: "#eb6834", /* orange — slot 2 */
  seriesRejected: "#1baf7a", /* aqua — slot 3 */
  statusGood: "#0ca30c",
  statusWarning: "#fab219",
  statusCritical: "#d03b3b",
  sparklineTrack: "#c3c2b7", /* de-emphasis / muted — palette.md's mode-invariant muted token */
} as const;
