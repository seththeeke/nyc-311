import type { ReactElement } from "react";

interface MetricTileBodyProps {
  value: string;
  detail?: string;
}

/** The big-number-plus-caption body shared by the Capacity tile and the workspace metric tiles. */
export function MetricTileBody({ value, detail }: MetricTileBodyProps): ReactElement {
  return (
    <>
      <p className="truncate text-xl font-semibold tracking-tight text-fg">{value}</p>
      {detail && <p className="mt-0.5 text-[11px] leading-snug text-fg-subtle">{detail}</p>}
    </>
  );
}
