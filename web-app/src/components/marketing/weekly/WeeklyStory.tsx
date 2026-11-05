import { useRef, type ReactElement } from "react";
import { useFleetLocations } from "../../../hooks/useFleetLocations";
import { useWorkspaceMetrics } from "../../../hooks/useWorkspaceMetrics";
import { formatCount, formatCurrency, formatHours } from "../../widgets/workspaceMetricFormat";
import { stepAt, useStickyProgress } from "../useStickyProgress";
import { CapacityTank } from "./CapacityTank";
import { CostRain } from "./CostRain";
import { RequestGrid } from "./RequestGrid";
import { ResolveClock } from "./ResolveClock";
import { WeeklyCard } from "./WeeklyCard";
import { share, weeklyStats } from "./weeklyStats";

const CARDS = 4;
const SCROLL_PER_CARD_VH = 55;
const whole = (v: number): string => formatCount(Math.round(v));

/*
 * "This week" as a scroll story over the fleet map's own weekly snapshot:
 * the section pins and each slice of scroll brings the next number forward
 * with its own visual: capacity as a pile of trucks, cost as a rain of dollars,
 * requests as a dot field, mean time to resolve as a stopwatch.
 */
export function WeeklyStory({ reducedMotion }: { reducedMotion: boolean }): ReactElement {
  const ref = useRef<HTMLElement>(null);
  const progress = useStickyProgress(ref);
  const active = stepAt(progress, CARDS);
  const { data: snapshot } = useWorkspaceMetrics();
  const { locations } = useFleetLocations();
  const stats = weeklyStats(snapshot, locations);
  const card = (i: number): { offset: number; reducedMotion: boolean } => ({ offset: i - active, reducedMotion });
  const rail = ["bg-hue-cyan", "bg-hue-emerald", "bg-hue-amber", "bg-hue-violet"];
  return (
    <section ref={ref} aria-labelledby="live-stats-title" className="relative" style={{ height: `calc(${CARDS * SCROLL_PER_CARD_VH}vh + 100vh)` }}>
      <div className="sticky top-0 flex h-[100svh] flex-col px-4 pb-8 pt-20 sm:px-8">
        <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-hue-emerald">Live, not a demo reel</p>
          <h2 id="live-stats-title" className="mt-2 text-3xl font-black tracking-tight text-fg sm:text-5xl">
            This week, in the five boroughs.
          </h2>
          <p className="mt-2 text-fg-muted">
            Here&apos;s a view of this week&apos;s data{stats.weekLabel ? `, from ${stats.weekLabel}` : ""}.
          </p>
          <ol aria-label="This week's numbers" className="mt-5 grid grid-cols-4 gap-2">
            {rail.map((hue, i) => (
              <li key={hue} aria-current={i === active ? "step" : undefined} className="h-1 overflow-hidden rounded-full bg-panel-strong">
                <span className={`block h-full origin-left rounded-full ${hue}`} style={{ transform: `scaleX(${Math.min(1, Math.max(0, progress * CARDS - i))})` }} />
              </li>
            ))}
          </ol>
          <div className="relative mt-6 flex-1 [perspective:1600px]">
            <WeeklyCard
              label="Capacity"
              value={stats.operators}
              format={whole}
              caption={stats.busy === null ? "active operators" : `active operators, ${stats.busy} out on a job right now`}
              delta={null}
              hueText="text-hue-cyan"
              hueShadow="shadow-[0_0_120px_-40px_var(--t-hue-cyan)]"
              {...card(0)}
            >
              <CapacityTank level={share(stats.busy, stats.operators)} active={active === 0} />
            </WeeklyCard>
            <WeeklyCard
              label="Total cost (est.)"
              value={stats.totalCost}
              format={formatCurrency}
              caption="The estimated cost of this week's repairs so far"
              delta={stats.costDelta}
              hueText="text-hue-emerald"
              hueShadow="shadow-[0_0_120px_-40px_var(--t-hue-emerald)]"
              {...card(1)}
            >
              <CostRain active={active === 1} />
            </WeeklyCard>
            <WeeklyCard
              label="Requests serviced"
              value={stats.serviced}
              format={whole}
              caption={stats.accepted === null ? "requests serviced" : `serviced, of ${formatCount(stats.accepted)} requests accepted`}
              delta={stats.servicedDelta}
              hueText="text-hue-amber"
              hueShadow="shadow-[0_0_120px_-40px_var(--t-hue-amber)]"
              {...card(2)}
            >
              <RequestGrid servicedShare={share(stats.serviced, stats.accepted)} active={active === 2} />
            </WeeklyCard>
            <WeeklyCard
              label="Mean time to resolve"
              value={stats.meanHours}
              format={formatHours}
              caption="From the 311 call to a closed job, on average"
              delta={stats.meanDelta}
              hueText="text-hue-violet"
              hueShadow="shadow-[0_0_120px_-40px_var(--t-hue-violet)]"
              {...card(3)}
            >
              <ResolveClock hours={stats.meanHours} active={active === 3} />
            </WeeklyCard>
          </div>
        </div>
      </div>
    </section>
  );
}
