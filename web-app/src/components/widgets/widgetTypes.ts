import type { ComponentType, LazyExoticComponent } from "react";
import type { WidgetId, WidgetSize, WidgetStatus } from "../../models/widget";

/** A widget decides how to render at the size it's given; it never knows which workspace hosts it. */
export interface WidgetProps {
  size: WidgetSize;
}

export interface WidgetDefinition {
  id: WidgetId;
  title: string;
  status: WidgetStatus;
  sizes: readonly WidgetSize[];
  /* How many columns of the secondary workspace's 2-column tile grid a TILE spans; defaults to 1. */
  tileSpan?: 1 | 2;
  /* `lazy()`-wrapped for a widget whose own imports are heavy (e.g. FLEET_MAP's leaflet) — see widgetRegistry.ts. */
  component: ComponentType<WidgetProps> | LazyExoticComponent<ComponentType<WidgetProps>>;
}
