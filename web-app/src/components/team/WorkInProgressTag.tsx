import type { ReactElement } from "react";

/** Marks a team member whose agent isn't running yet (docs/17-executive-team.md). */
export function WorkInProgressTag(): ReactElement {
  return <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-hue-amber">Work in progress</span>;
}
