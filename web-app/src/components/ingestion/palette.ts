/*
 * Chart data-encoding colors as CSS variables (index.css), so charts re-color
 * with the active theme. Both sets pass the dataviz validator: light slots
 * 1-4 against #ffffff, stepped dark slots 1-4 (>= 3:1) against the dark panel
 * #0c1222. Status colors are fixed across themes; chrome uses semantic tokens.
 */
export const IV_COLORS = {
  seriesIngested: "var(--iv-series-ingested)",
  seriesDuplicates: "var(--iv-series-duplicates)",
  seriesRejected: "var(--iv-series-rejected)",
  seriesFourth: "var(--iv-series-4)",
  statusGood: "var(--iv-status-good)",
  statusWarning: "var(--iv-status-warning)",
  statusCritical: "var(--iv-status-critical)",
  sparklineTrack: "var(--iv-sparkline-track)",
} as const;
