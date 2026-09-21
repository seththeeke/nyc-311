import { IV_COLORS } from "../../ingestion/palette";
import type { MockShare } from "./mockChartData";

/* Categorical slots 1-4, in fixed order — validated in both themes (see ingestion/palette.ts). */
export const SERIES_COLORS = [
  IV_COLORS.seriesIngested,
  IV_COLORS.seriesDuplicates,
  IV_COLORS.seriesRejected,
  IV_COLORS.seriesFourth,
] as const;

export interface Share {
  label: string;
  value: number;
  percent: number;
  color: string;
}

/** Normalizes raw values to percentages (rounded to 2 dp, so no float noise leaks into styles) and assigns colours by position; an all-zero input yields 0% shares, not NaN. */
export function toShares(items: readonly MockShare[]): Share[] {
  const total = items.reduce((sum, item) => sum + item.value, 0);
  return items.map((item, index) => ({
    label: item.label,
    value: item.value,
    percent: total > 0 ? Math.round((item.value / total) * 10000) / 100 : 0,
    color: SERIES_COLORS[index % SERIES_COLORS.length],
  }));
}

/** One line for an accessible name: "Completed 62%, Scheduled 21%, ...". */
export function describeShares(shares: readonly Share[]): string {
  return shares.map((share) => `${share.label} ${Math.round(share.percent)}%`).join(", ");
}

function polar(cx: number, cy: number, radius: number, fraction: number): [number, number] {
  const angle = fraction * 2 * Math.PI - Math.PI / 2;
  return [cx + radius * Math.cos(angle), cy + radius * Math.sin(angle)];
}

/** SVG path for a pie slice from `startFraction` to `endFraction` (0-1, clockwise from 12 o'clock). */
export function slicePath(cx: number, cy: number, radius: number, startFraction: number, endFraction: number): string {
  if (endFraction - startFraction >= 0.9999) {
    return `M ${cx} ${cy - radius} A ${radius} ${radius} 0 1 1 ${cx} ${cy + radius} A ${radius} ${radius} 0 1 1 ${cx} ${cy - radius} Z`;
  }
  const [x1, y1] = polar(cx, cy, radius, startFraction);
  const [x2, y2] = polar(cx, cy, radius, endFraction);
  const largeArc = endFraction - startFraction > 0.5 ? 1 : 0;
  return `M ${cx} ${cy} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`;
}
