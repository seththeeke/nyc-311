import type { ReactElement } from "react";
import { COMPLAINT_TICKER } from "./marketingContent";

/* An endless ticker of the street complaints New Yorkers file: the list twice over, slid by half its width, so the loop never shows a seam. */
export function ComplaintMarquee(): ReactElement {
  const items = [...COMPLAINT_TICKER, ...COMPLAINT_TICKER];
  return (
    <section aria-label="Street complaints BoroughSim handles" className="relative overflow-hidden border-y border-line py-5">
      <ul className="flex w-max animate-[mk-marquee_40s_linear_infinite] gap-10 whitespace-nowrap">
        {items.map((item, i) => (
          <li
            key={`${item}-${i}`}
            aria-hidden={i >= COMPLAINT_TICKER.length}
            className="flex items-center gap-10 text-2xl font-bold uppercase tracking-widest text-fg-subtle sm:text-3xl"
          >
            {item}
            <span aria-hidden="true" className="text-hue-amber">
              ✦
            </span>
          </li>
        ))}
      </ul>
      <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-surface" />
      <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-surface" />
    </section>
  );
}
