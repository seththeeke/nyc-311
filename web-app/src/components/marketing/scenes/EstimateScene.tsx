import type { ReactElement } from "react";
import { ESTIMATE_INPUTS, ESTIMATE_PARTS } from "../journeySteps";
import { useCountUp } from "../useCountUp";

const TOTAL = ESTIMATE_PARTS.reduce((sum, part) => sum + part.amount, 0);
const MAX_PART = Math.max(...ESTIMATE_PARTS.map((part) => part.amount));

/* Step 3: the complaint's metadata flows in as chips, the price breakdown grows, and the total counts up. */
export function EstimateScene({ instant }: { instant: boolean }): ReactElement {
  const total = Number(useCountUp(TOTAL, true, 1800, instant));
  return (
    <div className="flex h-full flex-col justify-center gap-7">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-fg-subtle">From the complaint</p>
        <ul className="mt-3 flex flex-wrap gap-2">
          {ESTIMATE_INPUTS.map((input, i) => (
            <li
              key={input}
              className="animate-[mk-rise_0.6s_ease-out_both] rounded-full border border-hue-violet/50 bg-hue-violet/10 px-3 py-1 text-sm font-medium text-fg"
              style={{ animationDelay: `${i * 150}ms` }}
            >
              {input}
            </li>
          ))}
        </ul>
      </div>
      <ul className="flex flex-col gap-3">
        {ESTIMATE_PARTS.map((part, i) => (
          <li key={part.label} className="grid grid-cols-[8rem_1fr_4rem] items-center gap-3 text-sm">
            <span className="text-fg-muted">{part.label}</span>
            <span className="h-2.5 overflow-hidden rounded-full bg-panel-strong">
              <span
                className="mk-beam block h-full origin-left animate-[mk-grow_1s_cubic-bezier(0.2,0.8,0.2,1)_both] rounded-full"
                style={{ width: `${(part.amount / MAX_PART) * 100}%`, animationDelay: `${600 + i * 200}ms` }}
              />
            </span>
            <span className="text-right tabular-nums text-fg">${part.amount}</span>
          </li>
        ))}
      </ul>
      <div className="flex items-end justify-between border-t border-line pt-5">
        <p className="text-sm text-fg-subtle">Estimated cost</p>
        <p className="mk-gradient-text text-5xl font-black tabular-nums">${Math.round(total).toLocaleString("en-US")}</p>
      </div>
      <p className="text-xs text-fg-subtle">Illustrative numbers. Real estimates come from real-world repair cost data.</p>
    </div>
  );
}
