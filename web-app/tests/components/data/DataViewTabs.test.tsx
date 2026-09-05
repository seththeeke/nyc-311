import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DataViewTabs, dataViewPanelId, dataViewTabId } from "../../../src/components/data/DataViewTabs";

describe("DataViewTabs", () => {
  it("renders a Jobs and a Performance tab, marking the active one selected", () => {
    render(<DataViewTabs view="jobs" onChange={vi.fn()} />);

    expect(screen.getByRole("tab", { name: "Jobs" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Performance" })).toHaveAttribute("aria-selected", "false");
  });

  it("reflects the given active view", () => {
    render(<DataViewTabs view="performance" onChange={vi.fn()} />);

    expect(screen.getByRole("tab", { name: "Performance" })).toHaveAttribute("aria-selected", "true");
  });

  it("wires each tab to its panel via id/aria-controls", () => {
    render(<DataViewTabs view="jobs" onChange={vi.fn()} />);

    const jobsTab = screen.getByRole("tab", { name: "Jobs" });
    expect(jobsTab).toHaveAttribute("id", dataViewTabId("jobs"));
    expect(jobsTab).toHaveAttribute("aria-controls", dataViewPanelId("jobs"));
  });

  it("calls onChange with the clicked view", async () => {
    const onChange = vi.fn();
    render(<DataViewTabs view="jobs" onChange={onChange} />);

    await userEvent.click(screen.getByRole("tab", { name: "Performance" }));

    expect(onChange).toHaveBeenCalledWith("performance");
  });

  it("labels the tablist for assistive tech", () => {
    render(<DataViewTabs view="jobs" onChange={vi.fn()} />);

    expect(screen.getByRole("tablist", { name: "Warehouse view" })).toBeInTheDocument();
  });
});
