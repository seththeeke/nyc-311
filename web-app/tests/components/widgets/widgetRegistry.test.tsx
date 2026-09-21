import { describe, expect, it } from "vitest";
import { DEFAULT_SECONDARY_WIDGET_IDS, getWidget, widgetSupportsSize } from "../../../src/components/widgets/widgetRegistry";
import { WIDGET_IDS, type WidgetId } from "../../../src/models/widget";

describe("widgetRegistry", () => {
  it("registers every declared widget id under its own id", () => {
    for (const id of WIDGET_IDS) {
      expect(getWidget(id).id).toBe(id);
    }
  });

  it("marks the map, Capacity, and Ingestion Volume as LIVE; the metric mocks are WORK_IN_PROGRESS", () => {
    const live = WIDGET_IDS.filter((id) => getWidget(id).status === "LIVE");
    expect(live).toEqual(["FLEET_MAP", "CAPACITY", "INGESTION_VOLUME"]);
  });

  it("the chart widgets span both columns of the tile grid; the number tiles don't", () => {
    const wide = WIDGET_IDS.filter((id) => getWidget(id).tileSpan === 2);
    expect(wide).toEqual(["INGESTION_VOLUME", "ORDERS_BY_STATUS", "FLEET_UTILIZATION"]);
  });

  it("throws on an unknown id instead of returning nothing", () => {
    expect(() => getWidget("NOPE" as WidgetId)).toThrow(/Unknown widget id/);
  });

  it("reports which sizes a widget supports", () => {
    expect(widgetSupportsSize(getWidget("FLEET_MAP"), "FULL")).toBe(true);
    expect(widgetSupportsSize(getWidget("FLEET_MAP"), "TILE")).toBe(false);
    expect(widgetSupportsSize(getWidget("CAPACITY"), "TILE")).toBe(true);
  });

  it("defaults the secondary workspace to Capacity, the five mock tiles, then the three wide charts, all TILE", () => {
    expect(DEFAULT_SECONDARY_WIDGET_IDS).toEqual([
      "CAPACITY",
      "TOTAL_REQUESTS",
      "SERVICED",
      "TOTAL_COST_EST",
      "MEAN_TIME_TO_RESOLVE",
      "MEDIAN_TIME_TO_RESOLVE",
      "INGESTION_VOLUME",
      "ORDERS_BY_STATUS",
      "FLEET_UTILIZATION",
    ]);
    for (const id of DEFAULT_SECONDARY_WIDGET_IDS) {
      expect(widgetSupportsSize(getWidget(id), "TILE")).toBe(true);
    }
  });
});
