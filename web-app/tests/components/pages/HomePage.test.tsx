import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { HomePage } from "../../../src/components/pages/HomePage";

vi.mock("../../../src/components/widgets/WidgetSlot", () => ({
  WidgetSlot: ({ widgetId, size }: { widgetId: string; size: string }) => (
    <div data-testid="widget-slot">{`${widgetId}:${size}`}</div>
  ),
}));

describe("HomePage", () => {
  it("renders the fleet map through the widget registry at FULL size", () => {
    render(<HomePage />);
    expect(screen.getByTestId("widget-slot")).toHaveTextContent("FLEET_MAP:FULL");
  });

  it("renders no title or nav of its own — the sidebar carries those", () => {
    render(<HomePage />);
    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});
