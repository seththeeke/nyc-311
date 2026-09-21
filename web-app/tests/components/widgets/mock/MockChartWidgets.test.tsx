import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MockFleetUtilizationWidget } from "../../../../src/components/widgets/mock/MockFleetUtilizationWidget";
import { MockOrdersByStatusWidget } from "../../../../src/components/widgets/mock/MockOrdersByStatusWidget";
import { SERIES_COLORS } from "../../../../src/components/widgets/mock/chartShares";

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

describe("MockFleetUtilizationWidget (stacked bar)", () => {
  it("draws one left-to-right segment per activity, sized by share", () => {
    const { container } = render(<MockFleetUtilizationWidget />);
    expect(screen.getByRole("img")).toHaveAccessibleName("Fleet utilization: Working 58%, In transit 27%, Idle 15%");
    const segments = [...container.querySelectorAll('[role="img"] > div')] as HTMLElement[];
    expect(segments.map((s) => s.style.width)).toEqual(["58%", "27%", "15%"]);
    expect(segments[0].parentElement).toHaveClass("flex");
  });

  it("names each segment in a legend below the bar with its percent", () => {
    render(<MockFleetUtilizationWidget />);
    for (const text of ["Working", "In transit", "Idle", "58%", "27%", "15%"]) {
      expect(screen.getByText(text)).toBeInTheDocument();
    }
  });
});
