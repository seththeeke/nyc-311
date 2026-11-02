import { useRef, type ReactElement } from "react";
import { useWorkspaceMetrics } from "../../hooks/useWorkspaceMetrics";
import { useFleetLocations } from "../../hooks/useFleetLocations";
import { formatCount, formatHours } from "../widgets/workspaceMetricFormat";
import { Reveal } from "./Reveal";
import { StatTile } from "./StatTile";
import { useInView } from "./useInView";

interface LiveStatsProps {
  reducedMotion: boolean;
}

const roundCount = (value: number): string => formatCount(Math.round(value));

/*
 * The proof: this week's real numbers from the public API (the same
 * `GET /workspace/metrics` and fleet roster the app's tiles read), counting
 * up as they scroll into view.
 */
export function LiveStats({ reducedMotion }: LiveStatsProps): ReactElement {
  const ref = useRef<HTMLDivElement>(null);
  const active = useInView(ref, 0.3);
  const { data: metrics } = useWorkspaceMetrics();
  const { locations } = useFleetLocations();
  const operators = locations?.operators ?? null;
  const working = operators?.filter((op) => op.current_activity !== "IDLE").length ?? null;
  const tiles = [
    { label: "Calls accepted", value: metrics?.metrics.REQUESTS_ACCEPTED.current ?? null, format: roundCount, caption: "Street complaints taken on this week", accent: "bg-hue-amber" },
    { label: "Streets fixed", value: metrics?.metrics.SERVICED.current ?? null, format: roundCount, caption: "Jobs driven to the curb and closed this week", accent: "bg-hue-emerald" },
    { label: "Median fix time", value: metrics?.metrics.MEDIAN_TIME_TO_RESOLVE_HOURS.current ?? null, format: formatHours, caption: "From the 311 call to a closed job", accent: "bg-hue-violet" },
    { label: "Operators", value: operators?.length ?? null, format: roundCount, caption: working === null ? "On the roster" : `${working} out on a job right now`, accent: "bg-hue-cyan" },
  ];
  return (
    <section aria-labelledby="live-stats-title" className="relative mx-auto max-w-6xl px-4 py-32 sm:px-8">
      <Reveal>
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-hue-emerald">Live, not a demo reel</p>
        <h2 id="live-stats-title" className="mt-4 max-w-3xl text-4xl font-black tracking-tight text-fg sm:text-6xl">
          This week, in the five boroughs.
        </h2>
      </Reveal>
      <div ref={ref} className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map((tile, i) => (
          <Reveal key={tile.label} delayMs={i * 120}>
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
