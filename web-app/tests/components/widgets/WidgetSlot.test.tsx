import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { WidgetSlot } from "../../../src/components/widgets/WidgetSlot";
import { WIDGET_IDS } from "../../../src/models/widget";
import { getWidget } from "../../../src/components/widgets/widgetRegistry";

vi.mock("../../../src/hooks/useFleetLocations", () => ({
  useFleetLocations: () => ({ locations: { operators: [] }, isLoading: false, error: null }),
}));
vi.mock("../../../src/components/FleetMap", () => ({ FleetMap: () => <div data-testid="fleet-map" /> }));

describe("WidgetSlot", () => {
  it("frames a TILE widget in a titled card", () => {
    render(<WidgetSlot widgetId="CAPACITY" size="TILE" />);
    expect(screen.getByRole("region", { name: "Capacity" })).toBeInTheDocument();
    expect(screen.queryByText("WIP")).not.toBeInTheDocument();
  });

  it("renders a FULL widget bare, with no card frame or badge for a LIVE one", () => {
    render(<WidgetSlot widgetId="FLEET_MAP" size="FULL" />);
    expect(screen.getByTestId("fleet-map")).toBeInTheDocument();
    expect(screen.queryByRole("region")).not.toBeInTheDocument();
    expect(screen.queryByText("WIP")).not.toBeInTheDocument();
  });

  it("rejects a size the widget doesn't support", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(() => render(<WidgetSlot widgetId="CAPACITY" size="FULL" />)).toThrow(/does not support size FULL/);
  });

  it("badges every WORK_IN_PROGRESS widget so no mock tile can go unmarked", () => {
    const wip = WIDGET_IDS.filter((id) => getWidget(id).status === "WORK_IN_PROGRESS");
    expect(wip).toHaveLength(5);
    for (const id of wip) {
      const { unmount } = render(<WidgetSlot widgetId={id} size="TILE" />);
      expect(screen.getByText("WIP")).toBeInTheDocument();
      expect(screen.getByRole("region", { name: getWidget(id).title })).toBeInTheDocument();
      unmount();
    }
  });

  it("badges a WORK_IN_PROGRESS FULL widget in the corner", () => {
    /* No FULL widget is WIP today; exercise the branch through a temporary registry entry. */
    const widget = getWidget("FLEET_MAP");
    const original = { status: widget.status };
    widget.status = "WORK_IN_PROGRESS";
    try {
      render(<WidgetSlot widgetId="FLEET_MAP" size="FULL" />);
      expect(screen.getByText("WIP")).toBeInTheDocument();
    } finally {
      widget.status = original.status;
    }
  });
});
