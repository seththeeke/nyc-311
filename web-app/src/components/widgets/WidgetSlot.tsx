import type { ReactElement } from "react";
import type { WidgetId, WidgetSize } from "../../models/widget";
import { getWidget, widgetSupportsSize } from "./widgetRegistry";
import { WidgetCard } from "./WidgetCard";

interface WidgetSlotProps {
  widgetId: WidgetId;
  size: WidgetSize;
}

/**
 * The one way the secondary workspace renders a widget: in the shared card
 * frame, with the WIP badge when it's still work in progress.
 */
export function WidgetSlot({ widgetId, size }: WidgetSlotProps): ReactElement {
  const widget = getWidget(widgetId);
  if (!widgetSupportsSize(widget, size)) {
    throw new Error(`Widget ${widgetId} does not support size ${size}`);
  }
  const Component = widget.component;
  const isWip = widget.status === "WORK_IN_PROGRESS";

  return (
    <WidgetCard title={widget.title} isWip={isWip} wide={widget.tileSpan === 2}>
      <Component size={size} />
    </WidgetCard>
  );
}
