import type { ReactElement } from "react";
import { IV_COLORS } from "./palette";

export interface SparklineProps {
  values: number[];
  accentColor?: string;
}

const WIDTH = 100;
const HEIGHT = 24;
const PADDING = 2;

/*
 * Figure contract (dataviz skill): a 12-point trend line in the de-emphasis
 * hue, with the current period picked out in the accent. Renders nothing
 * below two points — a single-point "trend" has no line to draw.
 */
export function Sparkline({ values, accentColor = IV_COLORS.seriesIngested }: SparklineProps): ReactElement | null {
  if (values.length < 2) return null;

  /*
   * Scaled to the series' own min/max (not a forced zero-baseline) — the
   * standard sparkline convention, since the point is relative movement,
   * not magnitude. `|| 1` only matters for a genuinely flat series (every
   * value equal), where max - min is exactly 0.
   */
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;
  const plotHeight = HEIGHT - PADDING * 2;

  const points = values.map((value, index) => {
    const x = (index / (values.length - 1)) * WIDTH;
    const y = PADDING + plotHeight - ((value - min) / range) * plotHeight;
    return { x, y };
  });

  const path = points.map((p) => `${p.x},${p.y}`).join(" ");
  const last = points[points.length - 1];

  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="h-6 w-full" aria-hidden="true">
      <polyline points={path} fill="none" stroke={IV_COLORS.sparklineTrack} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={last.x} cy={last.y} r="2.5" fill={accentColor} stroke="white" strokeWidth="1.5" />
    </svg>
  );
}
