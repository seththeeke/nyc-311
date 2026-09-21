import type { ReactElement } from "react";
import { WidgetSlot } from "../widgets/WidgetSlot";

/**
 * The public landing page — the fleet map, rendered through the widget
 * registry at FULL size (`12-UX-workspace-refactor.md` §4.3) so the same
 * widget system serves both workspaces. Title/nav live in the sidebar;
 * loading/error state overlays the map inside `FleetMapWidget`.
 */
export function HomePage(): ReactElement {
  return (
    <main className="relative h-full w-full">
      <WidgetSlot widgetId="FLEET_MAP" size="FULL" />
    </main>
  );
}
