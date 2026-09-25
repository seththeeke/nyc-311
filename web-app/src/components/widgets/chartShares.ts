import { IV_COLORS } from "../ingestion/palette";

/* Categorical slots 1-4, in fixed order — validated in both themes (see ingestion/palette.ts). */
export const SERIES_COLORS = [
  IV_COLORS.seriesIngested,
  IV_COLORS.seriesDuplicates,
  IV_COLORS.seriesRejected,
  IV_COLORS.seriesFourth,
] as const;

/** A raw label/value pair to turn into a chart Share — the shape any data source (mock or live) hands `toShares`. */
export interface ShareInput {
  label: string;
  value: number;
}

export interface Share {
  label: string;
  value: number;
  percent: number;
  color: string;
}

/** Normalizes raw values to percentages (rounded to 2 dp, so no float noise leaks into styles) and assigns colours by position; an all-zero input yields 0% shares, not NaN. */
export function toShares(items: readonly ShareInput[]): Share[] {
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
