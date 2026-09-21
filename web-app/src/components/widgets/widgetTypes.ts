import type { ComponentType } from "react";
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
  component: ComponentType<WidgetProps>;
}
