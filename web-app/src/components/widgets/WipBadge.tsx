import type { ReactElement } from "react";

/** The in-product reminder that a tile shows sample data — rendered by WidgetSlot for every WORK_IN_PROGRESS widget. */
export function WipBadge(): ReactElement {
  return (
    <span
      title="Work in progress"
      className="inline-flex shrink-0 items-center rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-hue-amber ring-1 ring-amber-400/30"
    >
      WIP
    </span>
  );
}
