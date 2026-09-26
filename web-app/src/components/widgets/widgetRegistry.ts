import type { WidgetId, WidgetSize } from "../../models/widget";
import { CapacityWidget } from "./CapacityWidget";
import { FleetUtilizationWidget } from "./FleetUtilizationWidget";
import { FleetMapWidget } from "./FleetMapWidget";
import { IngestionVolumeWidget } from "./IngestionVolumeWidget";
import { MeanTimeToResolveWidget } from "./MeanTimeToResolveWidget";
import { MedianTimeToResolveWidget } from "./MedianTimeToResolveWidget";
import { ServicedWidget } from "./ServicedWidget";
import { RequestsAcceptedWidget } from "./RequestsAcceptedWidget";
import { TotalCostWidget } from "./TotalCostWidget";
import type { WidgetDefinition } from "./widgetTypes";

/** The single place a widget is registered. */
const WIDGETS: Record<WidgetId, WidgetDefinition> = {
  FLEET_MAP: { id: "FLEET_MAP", title: "Fleet Map", status: "LIVE", sizes: ["FULL"], component: FleetMapWidget },
  CAPACITY: { id: "CAPACITY", title: "Capacity", status: "LIVE", sizes: ["TILE"], component: CapacityWidget },
  REQUESTS_ACCEPTED: {
    id: "REQUESTS_ACCEPTED",
    title: "Requests Accepted",
    status: "LIVE",
    sizes: ["TILE"],
    component: RequestsAcceptedWidget,
  },
  SERVICED: { id: "SERVICED", title: "Serviced", status: "LIVE", sizes: ["TILE"], component: ServicedWidget },
  TOTAL_COST_EST: {
    id: "TOTAL_COST_EST",
    title: "Total Cost (Est.)",
    status: "LIVE",
    sizes: ["TILE"],
    component: TotalCostWidget,
  },
  MEAN_TIME_TO_RESOLVE: {
    id: "MEAN_TIME_TO_RESOLVE",
    title: "Mean Time to Resolve",
    status: "LIVE",
    sizes: ["TILE"],
    component: MeanTimeToResolveWidget,
  },
  MEDIAN_TIME_TO_RESOLVE: {
    id: "MEDIAN_TIME_TO_RESOLVE",
    title: "Median Time to Resolve",
    status: "LIVE",
    sizes: ["TILE"],
    component: MedianTimeToResolveWidget,
  },
  INGESTION_VOLUME: {
    id: "INGESTION_VOLUME",
    title: "Ingestion Volume",
    status: "LIVE",
    sizes: ["TILE"],
    tileSpan: 2,
    component: IngestionVolumeWidget,
  },
  FLEET_UTILIZATION: {
    id: "FLEET_UTILIZATION",
    title: "Fleet Utilization",
    status: "LIVE",
    sizes: ["TILE"],
    tileSpan: 2,
    component: FleetUtilizationWidget,
  },
};

/** The secondary workspace's initial contents, top to bottom (12-UX-workspace-refactor.md §6). */
export const DEFAULT_SECONDARY_WIDGET_IDS: readonly WidgetId[] = [
  "CAPACITY",
  "REQUESTS_ACCEPTED",
  "SERVICED",
  "TOTAL_COST_EST",
  "MEAN_TIME_TO_RESOLVE",
  "MEDIAN_TIME_TO_RESOLVE",
  "INGESTION_VOLUME",
  "FLEET_UTILIZATION",
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
