import type { ReactElement } from "react";
import type { ResidentPersona } from "../../models/residentPersona";

interface DemeanorBarsProps {
  persona: ResidentPersona;
  /** Adds activity and follow-up, for the detail view. */
  detailed?: boolean;
}

interface Dial {
  label: string;
  value: number;
  barClass: string;
}

function dialsFor(persona: ResidentPersona, detailed: boolean): Dial[] {
  const dials: Dial[] = [
    { label: "Patience", value: persona.demeanor.patience, barClass: "bg-emerald-500" },
    { label: "Hostility", value: persona.demeanor.hostility, barClass: "bg-rose-500" },
    { label: "Verbosity", value: persona.demeanor.verbosity, barClass: "bg-sky-500" },
  ];
  if (detailed) {
    dials.push(
      { label: "Activity", value: persona.activity_level, barClass: "bg-amber-500" },
      { label: "Follow-up", value: persona.follow_up_propensity, barClass: "bg-violet-500" }
    );
  }
  return dials;
}

/** The persona's 0-100 dials as labelled meters. */
export function DemeanorBars({ persona, detailed = false }: DemeanorBarsProps): ReactElement {
  return (
    <ul className="space-y-1">
      {dialsFor(persona, detailed).map((dial) => (
        <li key={dial.label} className="flex items-center gap-2 text-[11px] text-fg-muted">
          <span className="w-16 shrink-0">{dial.label}</span>
          <span
            role="meter"
            aria-label={`${dial.label} ${dial.value} out of 100`}
            aria-valuenow={dial.value}
            aria-valuemin={0}
            aria-valuemax={100}
            className="h-1.5 flex-1 overflow-hidden rounded-full bg-panel-strong"
          >
            <span className={`block h-full rounded-full ${dial.barClass}`} style={{ width: `${dial.value}%` }} />
          </span>
          <span className="w-6 shrink-0 text-right tabular-nums">{dial.value}</span>
        </li>
      ))}
    </ul>
  );
}
