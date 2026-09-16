import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryTabBar } from "../../../src/components/query/QueryTabBar";
import type { QueryTab } from "../../../src/hooks/useQueryTabs";

const tabs: QueryTab[] = [
  { id: "tab-1", label: "Untitled query", sql: "", activeJobName: null, jobType: null },
  { id: "tab-2", label: "order_volume_by_zip", sql: "SELECT 1", activeJobName: "order_volume_by_zip", jobType: "SCHEDULED" },
];

describe("QueryTabBar", () => {
  it("renders every tab's label", () => {
    render(<QueryTabBar tabs={tabs} activeTabId="tab-1" onSelect={vi.fn()} onClose={vi.fn()} onAdd={vi.fn()} />);

    expect(screen.getByText("Untitled query")).toBeInTheDocument();
    expect(screen.getByText("order_volume_by_zip")).toBeInTheDocument();
  });

  it("marks the active tab with aria-selected", () => {
    render(<QueryTabBar tabs={tabs} activeTabId="tab-2" onSelect={vi.fn()} onClose={vi.fn()} onAdd={vi.fn()} />);

    expect(screen.getByRole("tab", { name: /order_volume_by_zip/ })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: /Untitled query/ })).toHaveAttribute("aria-selected", "false");
  });

  it("calls onSelect with the clicked tab's id", async () => {
    const onSelect = vi.fn();
    render(<QueryTabBar tabs={tabs} activeTabId="tab-1" onSelect={onSelect} onClose={vi.fn()} onAdd={vi.fn()} />);

    await userEvent.click(screen.getByText("order_volume_by_zip"));

    expect(onSelect).toHaveBeenCalledWith("tab-2");
  });

  it("calls onClose with the tab's id when its close button is clicked", async () => {
    const onClose = vi.fn();
    render(<QueryTabBar tabs={tabs} activeTabId="tab-1" onSelect={vi.fn()} onClose={onClose} onAdd={vi.fn()} />);

    await userEvent.click(screen.getByLabelText("Close Untitled query"));

    expect(onClose).toHaveBeenCalledWith("tab-1");
  });

  it("calls onAdd when the + button is clicked", async () => {
    const onAdd = vi.fn();
    render(<QueryTabBar tabs={tabs} activeTabId="tab-1" onSelect={vi.fn()} onClose={vi.fn()} onAdd={onAdd} />);

    await userEvent.click(screen.getByLabelText("New query tab"));

    expect(onAdd).toHaveBeenCalled();
  });
});
