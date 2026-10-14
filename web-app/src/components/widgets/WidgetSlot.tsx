import { Suspense, type ReactElement } from "react";
import type { WidgetId, WidgetSize } from "../../models/widget";
import { getWidget, widgetSupportsSize } from "./widgetRegistry";
import { WidgetCard } from "./WidgetCard";
import { WipBadge } from "./WipBadge";
import { SpinnerIcon } from "../icons";

interface WidgetSlotProps {
  widgetId: WidgetId;
  size: WidgetSize;
}

/*
 * A registry entry's component may be `lazy()`-wrapped (FLEET_MAP, to keep
 * leaflet out of the eager main chunk — see widgetRegistry.ts), so every
 * widget renders inside a Suspense boundary. The fallback only shows for
 * that first dynamic-import fetch, not on every mount.
 */
function WidgetLoadingFallback(): ReactElement {
  return (
    <div className="flex h-full w-full items-center justify-center">
      <SpinnerIcon className="h-6 w-6" />
    </div>
  );
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
        <Suspense fallback={<WidgetLoadingFallback />}>
          <Component size={size} />
        </Suspense>
        {isWip && (
          <div className="absolute top-3 right-3 z-[1000]">
            <WipBadge />
          </div>
        )}
      </div>
    );
  }
  return (
    <WidgetCard title={widget.title} isWip={isWip} wide={widget.tileSpan === 2}>
      <Suspense fallback={<WidgetLoadingFallback />}>
        <Component size={size} />
      </Suspense>
    </WidgetCard>
  );
}
