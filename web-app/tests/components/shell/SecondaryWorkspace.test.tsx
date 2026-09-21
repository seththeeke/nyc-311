import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SecondaryWorkspace } from "../../../src/components/shell/SecondaryWorkspace";
import { WorkspaceProvider } from "../../../src/components/shell/WorkspaceProvider";
import type { WidgetId } from "../../../src/models/widget";

vi.mock("../../../src/hooks/useFleetLocations", () => ({
  useFleetLocations: () => ({ locations: { operators: [{}, {}, {}] }, isLoading: false, error: null }),
}));

function renderPanel(ids?: readonly WidgetId[], onCollapse = vi.fn()) {
  render(
    <WorkspaceProvider initialSecondaryWidgetIds={ids}>
      <SecondaryWorkspace onCollapse={onCollapse} />
    </WorkspaceProvider>,
  );
  return onCollapse;
}

describe("SecondaryWorkspace", () => {
  it("renders the default tiles top-to-bottom: live Capacity, then the five WIP mocks", () => {
    renderPanel();
    const titles = screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);
    expect(titles).toEqual([
      "Capacity",
      "Total Requests",
      "Serviced",
      "Total Cost (Est.)",
      "Mean Time to Resolve",
      "Median Time to Resolve",
    ]);
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getAllByText("WIP")).toHaveLength(5);
  });

  it("lays tiles out two per row, compactly", () => {
    renderPanel();
    const grid = screen.getByRole("region", { name: "Capacity" }).parentElement;
    expect(grid).toHaveClass("grid", "grid-cols-2");
    expect(screen.getByRole("region", { name: "Capacity" })).toHaveClass("p-3");
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
