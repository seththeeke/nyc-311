import type { ReactElement } from "react";
import type { ScorecardEntry } from "../../models/staffMeeting";
import { formatMetric, metricTrend, onTarget } from "./teamFormat";

const TREND_GLYPH = { BETTER: "▲", WORSE: "▼", FLAT: "–" } as const;
const TREND_CLASS = { BETTER: "text-hue-emerald", WORSE: "text-hue-rose", FLAT: "text-fg-subtle" } as const;
const TREND_WORD = { BETTER: "better than", WORSE: "worse than", FLAT: "same as" } as const;

/** The fixed scorecard every meeting reviews: today's value, its target, and which way it moved since the last meeting. */
export function MeetingScorecard({ entries }: { entries: readonly ScorecardEntry[] }): ReactElement {
  return (
    <ul aria-label="Scorecard" className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-7">
      {entries.map((entry) => {
        const trend = metricTrend(entry);
        const hit = onTarget(entry);
        return (
          <li key={entry.metric} className="rounded-xl border border-line bg-panel p-3">
            <p className="truncate text-[11px] text-fg-subtle">{entry.label}</p>
            <p className="mt-1 flex items-baseline gap-1.5">
              <span className={`text-lg font-semibold ${hit ? "text-fg" : "text-hue-amber"}`}>{formatMetric(entry.value, entry.unit)}</span>
              <span className={`text-xs ${TREND_CLASS[trend]}`} aria-label={`${TREND_WORD[trend]} last meeting`}>
                {TREND_GLYPH[trend]}
              </span>
            </p>
            <p className="text-[11px] text-fg-subtle">
              Target {entry.better === "UP" ? "≥" : "≤"} {formatMetric(entry.target, entry.unit)}
            </p>
          </li>
        );
      })}
    </ul>
  );
}
