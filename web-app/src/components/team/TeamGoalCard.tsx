import type { ReactElement } from "react";

/** What the profile slot shows before anyone is picked: the one goal, and why the roles pull against each other. */
export function TeamGoalCard(): ReactElement {
  return (
    <section aria-label="The goal" className="rounded-2xl border border-line bg-panel p-5">
      <p className="text-xs font-medium uppercase tracking-wide text-fg-subtle">One goal</p>
      <p className="mt-1 text-lg font-semibold text-fg">Lower cost. Same high-quality service.</p>
      <p className="mt-3 text-sm leading-relaxed text-fg-muted">
        Every executive chases it from a different side. Operations protects service, product looks for savings, finance holds the budget,
        and engineering decides what&apos;s worth building. They argue it out every morning in the Staff Meeting, and the scorecard keeps
        everyone honest.
      </p>
      <p className="mt-3 text-xs text-fg-subtle">Pick anyone on the chart to meet them.</p>
    </section>
  );
}
