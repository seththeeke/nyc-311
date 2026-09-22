import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MockOrdersByStatusWidget } from "../../../../src/components/widgets/mock/MockOrdersByStatusWidget";
import { SERIES_COLORS } from "../../../../src/components/widgets/chartShares";

describe("MockOrdersByStatusWidget (pie)", () => {
  it("draws one slice per status in the fixed categorical colours, with the numbers in its accessible name", () => {
    const { container } = render(<MockOrdersByStatusWidget />);
    expect(screen.getByRole("img")).toHaveAccessibleName(
      "Orders by status: Completed 62%, Scheduled 21%, In progress 12%, Rejected 5%",
    );
    const slices = [...container.querySelectorAll("svg path")];
    expect(slices).toHaveLength(4);
    expect(slices.map((s) => s.getAttribute("fill"))).toEqual([...SERIES_COLORS]);
  });

  it("names every slice in a legend with its percent — nothing is colour-only", () => {
    render(<MockOrdersByStatusWidget />);
    for (const text of ["Completed", "Scheduled", "In progress", "Rejected", "62%", "5%"]) {
      expect(screen.getByText(text)).toBeInTheDocument();
    }
  });

  it("gives each slice a hover title", () => {
    const { container } = render(<MockOrdersByStatusWidget />);
    expect([...container.querySelectorAll("svg path title")].map((t) => t.textContent)).toContain("Completed: 62%");
  });
});
