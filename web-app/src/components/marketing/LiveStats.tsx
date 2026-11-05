import { useRef, type ReactElement } from "react";
import { useWorkspaceMetrics } from "../../hooks/useWorkspaceMetrics";
import { useFleetLocations } from "../../hooks/useFleetLocations";
import type { WorkspaceMetricId } from "../../models/workspaceMetrics";
import { formatCount, formatCurrency, formatHours, formatWeekDelta, formatWeekLabel } from "../widgets/workspaceMetricFormat";
import { Reveal } from "./Reveal";
import { StatTile } from "./StatTile";
import { useInView } from "./useInView";

interface LiveStatsProps {
  reducedMotion: boolean;
}

/* The map workspace's weekly snapshot tiles, in its order, with its labels and formats. */
const METRIC_TILES: readonly { id: WorkspaceMetricId; label: string; format: (value: number) => string; accent: string }[] = [
  { id: "REQUESTS_ACCEPTED", label: "Requests Accepted", format: (v) => formatCount(Math.round(v)), accent: "bg-hue-amber" },
  { id: "SERVICED", label: "Serviced", format: (v) => formatCount(Math.round(v)), accent: "bg-hue-emerald" },
  { id: "TOTAL_COST", label: "Total Cost (Est.)", format: formatCurrency, accent: "bg-hue-rose" },
  { id: "MEAN_TIME_TO_RESOLVE_HOURS", label: "Mean Time to Resolve", format: formatHours, accent: "bg-hue-violet" },
  { id: "MEDIAN_TIME_TO_RESOLVE_HOURS", label: "Median Time to Resolve", format: formatHours, accent: "bg-hue-indigo" },
];

/*
 * The proof: the exact weekly snapshot the fleet map's secondary workspace
 * shows, from the same cached `GET /workspace/metrics` query and fleet roster,
 * with the same week-over-week deltas, counting up as it scrolls into view.
 */
export function LiveStats({ reducedMotion }: LiveStatsProps): ReactElement {
  const ref = useRef<HTMLDivElement>(null);
  const active = useInView(ref, 0.3);
  const { data: snapshot } = useWorkspaceMetrics();
  const { locations } = useFleetLocations();
  const week = snapshot ? `week to date from ${formatWeekLabel(snapshot.week_start)}` : "this week";
  const tiles = [
    { label: "Capacity", value: locations?.operators.length ?? null, format: (v: number) => formatCount(Math.round(v)), caption: "active operators", accent: "bg-hue-cyan" },
    ...METRIC_TILES.map((tile) => {
      const metric = snapshot?.metrics[tile.id];
      const current = metric?.current ?? null;
      const delta = current === null ? null : formatWeekDelta(current, metric?.previous ?? null);
      return { label: tile.label, value: current, format: tile.format, caption: delta ?? week, accent: tile.accent };
    }),
  ];
  return (
    <section aria-labelledby="live-stats-title" className="relative mx-auto max-w-6xl px-4 py-32 sm:px-8">
      <Reveal>
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-hue-emerald">Live, not a demo reel</p>
        <h2 id="live-stats-title" className="mt-4 max-w-3xl text-4xl font-black tracking-tight text-fg sm:text-6xl">
          This week, in the five boroughs.
        </h2>
        <p className="mt-6 text-fg-muted">
          The fleet map&apos;s own weekly snapshot, {week}, against the same days last week.
        </p>
      </Reveal>
      <div ref={ref} className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {tiles.map((tile, i) => (
          <Reveal key={tile.label} delayMs={i * 100}>
            <StatTile
              label={tile.label}
              value={tile.value}
              format={tile.format}
              caption={tile.caption}
              active={active}
              instant={reducedMotion}
              accentClass={tile.accent}
            />
          </Reveal>
        ))}
      </div>
    </section>
  );
}
