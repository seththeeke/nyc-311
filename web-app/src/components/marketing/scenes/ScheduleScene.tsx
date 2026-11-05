import type { ReactElement } from "react";
import { SCHEDULE_DROP, SCHEDULE_LANES } from "../journeySteps";

const SHIFT = 10;
const pct = (tenths: number): string => `${(tenths / SHIFT) * 100}%`;

/* Step 4: the fleet board. Lanes of booked jobs fill in, then the new order drops into the free slot it fits. */
export function ScheduleScene(): ReactElement {
  return (
    <div className="flex h-full flex-col justify-center gap-4">
      <p className="text-xs font-semibold uppercase tracking-widest text-fg-subtle">Today&apos;s fleet</p>
      <ul className="flex flex-col gap-3">
        {SCHEDULE_LANES.map((lane, laneIndex) => (
          <li key={lane.operator} className="grid grid-cols-[6.5rem_1fr] items-center gap-3">
            <span className={`text-sm ${laneIndex === SCHEDULE_DROP.lane ? "font-bold text-hue-cyan" : "text-fg-muted"}`}>{lane.operator}</span>
            <span className="relative h-9 rounded-lg bg-panel-sunken">
              {lane.jobs.map(([start, length], i) => (
                <span
                  key={start}
                  className="absolute inset-y-1 animate-[mk-rise_0.5s_ease-out_both] rounded-md bg-panel-strong"
                  style={{ left: pct(start), width: pct(length), animationDelay: `${laneIndex * 120 + i * 80}ms` }}
                />
              ))}
              {laneIndex === SCHEDULE_DROP.lane && (
                <span
                  data-testid="new-order"
                  className="absolute inset-y-0.5 flex animate-[mk-drop_0.9s_cubic-bezier(0.3,1.4,0.5,1)_both] items-center justify-center rounded-md bg-hue-cyan text-xs font-black text-surface shadow-[0_0_30px_var(--t-hue-cyan)]"
                  style={{ left: pct(SCHEDULE_DROP.start), width: pct(SCHEDULE_DROP.length), animationDelay: "900ms" }}
                >
                  NEW
                </span>
              )}
            </span>
          </li>
        ))}
      </ul>
      <p className="animate-[mk-rise_0.6s_ease-out_both] text-sm text-fg-muted" style={{ animationDelay: "1600ms" }}>
        Assigned to <span className="font-bold text-hue-cyan">Operator 03</span>, the soonest to reach it.
      </p>
    </div>
  );
}
