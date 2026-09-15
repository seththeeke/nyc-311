import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CollapsiblePanel } from "../../src/components/CollapsiblePanel";

describe("CollapsiblePanel", () => {
  it("renders the title and children when expanded", () => {
    render(
      <CollapsiblePanel title="Schema" collapsed={false} onToggle={vi.fn()}>
        <p>panel body</p>
      </CollapsiblePanel>
    );

    expect(screen.getByRole("heading", { name: "Schema" })).toBeInTheDocument();
    expect(screen.getByText("panel body")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Hide Schema" })).toHaveAttribute("aria-expanded", "true");
  });

  it("hides the title and children when collapsed", () => {
    render(
      <CollapsiblePanel title="Schema" collapsed={true} onToggle={vi.fn()}>
        <p>panel body</p>
      </CollapsiblePanel>
    );

    expect(screen.queryByRole("heading", { name: "Schema" })).not.toBeInTheDocument();
    expect(screen.queryByText("panel body")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Show Schema" })).toHaveAttribute("aria-expanded", "false");
  });

  it("calls onToggle when the toggle button is clicked", async () => {
    const onToggle = vi.fn();
    render(
      <CollapsiblePanel title="Jobs" collapsed={false} onToggle={onToggle}>
        <p>panel body</p>
      </CollapsiblePanel>
    );

    await userEvent.setup().click(screen.getByRole("button", { name: "Hide Jobs" }));

    expect(onToggle).toHaveBeenCalledTimes(1);
  });
});
