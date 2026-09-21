import type { ReactElement, ReactNode } from "react";
import { WipBadge } from "./WipBadge";

interface WidgetCardProps {
  title: string;
  isWip: boolean;
  children: ReactNode;
}

/** Shared compact frame for TILE/PANEL widgets: title row (with the WIP badge when applicable) over the widget body. */
export function WidgetCard({ title, isWip, children }: WidgetCardProps): ReactElement {
  return (
    <section aria-label={title} className="min-w-0 rounded-lg border border-line bg-panel p-3">
      <header className="flex items-start justify-between gap-1">
        <h2 className="text-xs leading-tight font-medium text-fg-muted">{title}</h2>
        {isWip && <WipBadge />}
      </header>
      <div className="mt-1.5">{children}</div>
    </section>
  );
}
