import { describe, expect, it } from "vitest";
import { DEFAULT_SECONDARY_WIDGET_IDS, getWidget, widgetSupportsSize } from "../../../src/components/widgets/widgetRegistry";
import { WIDGET_IDS, type WidgetId } from "../../../src/models/widget";

describe("widgetRegistry", () => {
  it("registers every declared widget id under its own id", () => {
    for (const id of WIDGET_IDS) {
      expect(getWidget(id).id).toBe(id);
    }
  });

  it("marks only Capacity and the map as LIVE; the metric mocks are WORK_IN_PROGRESS", () => {
    const live = WIDGET_IDS.filter((id) => getWidget(id).status === "LIVE");
    expect(live).toEqual(["FLEET_MAP", "CAPACITY"]);
  });

  it("throws on an unknown id instead of returning nothing", () => {
    expect(() => getWidget("NOPE" as WidgetId)).toThrow(/Unknown widget id/);
  });

  it("reports which sizes a widget supports", () => {
    expect(widgetSupportsSize(getWidget("FLEET_MAP"), "FULL")).toBe(true);
    expect(widgetSupportsSize(getWidget("FLEET_MAP"), "TILE")).toBe(false);
    expect(widgetSupportsSize(getWidget("CAPACITY"), "TILE")).toBe(true);
  });

  it("defaults the secondary workspace to Capacity then the five mock tiles, all registered as TILE", () => {
    expect(DEFAULT_SECONDARY_WIDGET_IDS).toEqual([
      "CAPACITY",
      "TOTAL_REQUESTS",
      "SERVICED",
      "TOTAL_COST_EST",
      "MEAN_TIME_TO_RESOLVE",
      "MEDIAN_TIME_TO_RESOLVE",
    ]);
    for (const id of DEFAULT_SECONDARY_WIDGET_IDS) {
      expect(widgetSupportsSize(getWidget(id), "TILE")).toBe(true);
    }
  });
});
