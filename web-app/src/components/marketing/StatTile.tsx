import type { ReactElement } from "react";
import { useCountUp } from "./useCountUp";

interface StatTileProps {
  label: string;
  value: number | null;
  format: (value: number) => string;
  caption: string;
  active: boolean;
  instant: boolean;
  accentClass: string;
}

const COUNT_UP_MS = 2200;

/* One live number: counts up from zero the first time it scrolls into view; "—" until the API has a value. */
export function StatTile({ label, value, format, caption, active, instant, accentClass }: StatTileProps): ReactElement {
  const shown = useCountUp(value, active, COUNT_UP_MS, instant);
  return (
    <div className="glass group relative overflow-hidden rounded-3xl p-7 transition-transform duration-500 hover:-translate-y-1">
      <div aria-hidden="true" className={`absolute -right-16 -top-16 h-40 w-40 rounded-full opacity-20 blur-3xl transition-opacity duration-500 group-hover:opacity-40 ${accentClass}`} />
      <p className="text-sm font-medium uppercase tracking-widest text-fg-subtle">{label}</p>
      <p className="mt-4 text-5xl font-black tabular-nums tracking-tight text-fg sm:text-6xl">
        {shown === null ? "—" : format(shown)}
      </p>
      <p className="mt-3 text-sm text-fg-muted">{caption}</p>
    </div>
  );
}
