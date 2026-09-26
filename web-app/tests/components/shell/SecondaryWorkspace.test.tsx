import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SecondaryWorkspace } from "../../../src/components/shell/SecondaryWorkspace";
import { WorkspaceProvider } from "../../../src/components/shell/WorkspaceProvider";
import type { WidgetId } from "../../../src/models/widget";

vi.mock("../../../src/hooks/useFleetLocations", () => ({
  useFleetLocations: () => ({
    locations: { operators: [{ current_activity: "WORKING" }, { current_activity: "WORKING" }, { current_activity: "IDLE" }] },
    isLoading: false,
    error: null,
  }),
}));
vi.mock("../../../src/hooks/usePollerMetrics", () => ({
  usePollerMetrics: () => ({ data: { cursor: null, metrics: [] }, isPending: false, isError: false }),
}));
vi.mock("../../../src/hooks/useWorkspaceMetrics", async () => {
  const { MOCK_WORKSPACE_METRICS } = await import("../../../src/test-data/workspaceMetrics");
  return { useWorkspaceMetrics: () => ({ data: MOCK_WORKSPACE_METRICS, isPending: false, isError: false }) };
});

function renderPanel(ids?: readonly WidgetId[], onCollapse = vi.fn()) {
  render(
    <WorkspaceProvider initialSecondaryWidgetIds={ids}>
      <SecondaryWorkspace onCollapse={onCollapse} />
    </WorkspaceProvider>,
  );
  return onCollapse;
}

describe("SecondaryWorkspace", () => {
  it("renders the default tiles top-to-bottom: live Capacity, the live metric tiles, Ingestion Volume, then live Fleet Utilization", () => {
    renderPanel();
    const titles = screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);
    expect(titles).toEqual([
      "Capacity",
      "Requests Accepted",
      "Serviced",
      "Total Cost (Est.)",
      "Mean Time to Resolve",
      "Median Time to Resolve",
      "Ingestion Volume",
      "Fleet Utilization",
    ]);
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.queryByText("WIP")).not.toBeInTheDocument();
    expect(screen.getByRole("status", { name: /^Serviced: 411/ })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /Fleet utilization: Working 67%/ })).toBeInTheDocument();
  });

  it("lays tiles out two per row, compactly", () => {
    renderPanel();
    const grid = screen.getByRole("region", { name: "Capacity" }).parentElement;
    expect(grid).toHaveClass("grid", "grid-cols-2");
    expect(screen.getByRole("region", { name: "Capacity" })).toHaveClass("p-3", "glass");
    expect(screen.getByRole("region", { name: "Capacity" })).not.toHaveClass("col-span-2");
    expect(screen.getByRole("region", { name: "Ingestion Volume" })).toHaveClass("col-span-2");
  });

  it("renders whatever ids workspace state holds, not a hard-coded list", () => {
    renderPanel(["SERVICED"]);
    expect(screen.getAllByRole("heading", { level: 2 })).toHaveLength(1);
    expect(screen.getByRole("region", { name: "Serviced" })).toBeInTheDocument();
  });

  it("hides via its collapse button", async () => {
    const onCollapse = renderPanel(["CAPACITY"]);
    await userEvent.setup().click(screen.getByRole("button", { name: "Hide secondary panel" }));
    expect(onCollapse).toHaveBeenCalled();
  });
});
