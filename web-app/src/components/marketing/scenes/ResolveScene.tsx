import type { ReactElement } from "react";

const SPARKS = 12;

/* Step 5: a check draws itself inside a ring, sparks fly out, and the resolution is sent on to the resident. */
export function ResolveScene(): ReactElement {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 text-center">
      <div className="relative h-40 w-40">
        {Array.from({ length: SPARKS }, (_, i) => (
          <span
            key={i}
            aria-hidden="true"
            className="absolute left-1/2 top-1/2 h-1.5 w-1.5 rounded-full bg-hue-emerald"
            style={{ transform: `rotate(${(360 / SPARKS) * i}deg)` }}
          >
            <span className="block h-full w-full animate-[mk-spark_1.1s_ease-out_both] rounded-full bg-hue-emerald" style={{ animationDelay: "900ms" }} />
          </span>
        ))}
        <svg viewBox="0 0 100 100" className="h-full w-full drop-shadow-[0_0_24px_var(--t-hue-emerald)]" aria-hidden="true">
          <circle cx="50" cy="50" r="44" fill="none" stroke="var(--t-hue-emerald)" strokeWidth="4" pathLength={1} className="mk-draw" />
          <path d="M30 52 L45 66 L71 37" fill="none" stroke="var(--t-hue-emerald)" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" pathLength={1} className="mk-draw" style={{ animationDelay: "500ms" }} />
        </svg>
      </div>
      <p className="animate-[mk-rise_0.6s_ease-out_both] text-3xl font-black text-fg" style={{ animationDelay: "800ms" }}>
        Resolved
      </p>
      <p
        className="animate-[mk-rise_0.6s_ease-out_both] rounded-full border border-hue-emerald/40 bg-hue-emerald/10 px-4 py-1.5 font-mono text-xs text-hue-emerald"
        style={{ animationDelay: "1200ms" }}
      >
        ORDER_RESOLVED → residents following it
      </p>
    </div>
  );
}
