import type { ReactElement, ReactNode } from "react";
import { WipBadge } from "./WipBadge";

interface WidgetCardProps {
  title: string;
  isWip: boolean;
  /* Spans both columns of the secondary workspace's tile grid. */
  wide?: boolean;
  children: ReactNode;
}

/** Shared compact frame for TILE/PANEL widgets: title row (with the WIP badge when applicable) over the widget body. */
export function WidgetCard({ title, isWip, wide = false, children }: WidgetCardProps): ReactElement {
  return (
    <section aria-label={title} className={`glass min-w-0 rounded-lg p-3 ${wide ? "col-span-2" : ""}`}>
      <header className="flex items-start justify-between gap-1">
        <h2 className="text-xs leading-tight font-medium text-fg-muted">{title}</h2>
        {isWip && <WipBadge />}
      </header>
      <div className="mt-1.5">{children}</div>
    </section>
  );
}
