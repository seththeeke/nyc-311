import type { WidgetId, WidgetSize } from "../../models/widget";
import { CapacityWidget } from "./CapacityWidget";
import { FleetMapWidget } from "./FleetMapWidget";
import {
  MeanTimeToResolveWidget,
  MedianTimeToResolveWidget,
  ServicedWidget,
  TotalCostEstWidget,
  TotalRequestsWidget,
} from "./mock/MockMetricWidgets";
import type { WidgetDefinition } from "./widgetTypes";

/** The single place a widget is registered. */
const WIDGETS: Record<WidgetId, WidgetDefinition> = {
  FLEET_MAP: { id: "FLEET_MAP", title: "Fleet Map", status: "LIVE", sizes: ["FULL"], component: FleetMapWidget },
  CAPACITY: { id: "CAPACITY", title: "Capacity", status: "LIVE", sizes: ["TILE"], component: CapacityWidget },
  TOTAL_REQUESTS: {
    id: "TOTAL_REQUESTS",
    title: "Total Requests",
    status: "WORK_IN_PROGRESS",
    sizes: ["TILE"],
    component: TotalRequestsWidget,
  },
  SERVICED: { id: "SERVICED", title: "Serviced", status: "WORK_IN_PROGRESS", sizes: ["TILE"], component: ServicedWidget },
  TOTAL_COST_EST: {
    id: "TOTAL_COST_EST",
    title: "Total Cost (Est.)",
    status: "WORK_IN_PROGRESS",
    sizes: ["TILE"],
    component: TotalCostEstWidget,
  },
  MEAN_TIME_TO_RESOLVE: {
    id: "MEAN_TIME_TO_RESOLVE",
    title: "Mean Time to Resolve",
    status: "WORK_IN_PROGRESS",
    sizes: ["TILE"],
    component: MeanTimeToResolveWidget,
  },
  MEDIAN_TIME_TO_RESOLVE: {
    id: "MEDIAN_TIME_TO_RESOLVE",
    title: "Median Time to Resolve",
    status: "WORK_IN_PROGRESS",
    sizes: ["TILE"],
    component: MedianTimeToResolveWidget,
  },
};

/** The secondary workspace's initial contents, top to bottom (12-UX-workspace-refactor.md §6). */
export const DEFAULT_SECONDARY_WIDGET_IDS: readonly WidgetId[] = [
  "CAPACITY",
  "TOTAL_REQUESTS",
  "SERVICED",
  "TOTAL_COST_EST",
  "MEAN_TIME_TO_RESOLVE",
  "MEDIAN_TIME_TO_RESOLVE",
];

/** Throws on an unknown id — fail loudly rather than render a silent blank tile. */
export function getWidget(id: WidgetId): WidgetDefinition {
  const widget = WIDGETS[id] as WidgetDefinition | undefined;
  if (!widget) throw new Error(`Unknown widget id: ${id}`);
  return widget;
}

export function widgetSupportsSize(widget: WidgetDefinition, size: WidgetSize): boolean {
  return widget.sizes.includes(size);
}
