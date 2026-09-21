import type { ReactElement } from "react";
import type { WidgetId, WidgetSize } from "../../models/widget";
import { getWidget, widgetSupportsSize } from "./widgetRegistry";
import { WidgetCard } from "./WidgetCard";
import { WipBadge } from "./WipBadge";

interface WidgetSlotProps {
  widgetId: WidgetId;
  size: WidgetSize;
}

/**
 * The one way either workspace renders a widget. TILE/PANEL widgets get the
 * shared card frame; a FULL widget fills its container bare, with the WIP
 * badge floated in the corner if it's still work in progress.
 */
export function WidgetSlot({ widgetId, size }: WidgetSlotProps): ReactElement {
  const widget = getWidget(widgetId);
  if (!widgetSupportsSize(widget, size)) {
    throw new Error(`Widget ${widgetId} does not support size ${size}`);
  }
  const Component = widget.component;
  const isWip = widget.status === "WORK_IN_PROGRESS";

  if (size === "FULL") {
    return (
      <div className="relative h-full w-full">
        <Component size={size} />
        {isWip && (
          <div className="absolute top-3 right-3 z-[1000]">
            <WipBadge />
          </div>
        )}
      </div>
    );
  }
  return (
    <WidgetCard title={widget.title} isWip={isWip}>
      <Component size={size} />
    </WidgetCard>
  );
}
