import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { FleetMapLegend } from "../../src/components/FleetMapLegend";
import { ACTIVITY_COLOR } from "../../src/components/fleetActivityStyle";

describe("FleetMapLegend", () => {
  it("lists each status with its meaning, in order", () => {
    render(<FleetMapLegend />);
    const items = within(screen.getByRole("group", { name: "Fleet status legend" })).getAllByRole("listitem");
    expect(items.map((li) => li.textContent)).toEqual([
      "Idleavailable",
      "In transitheading to a job",
      "Workingon a job",
    ]);
  });

  it("draws a truck in each status's exact map-marker colour", () => {
    const { container } = render(<FleetMapLegend />);
    const fills = [...container.querySelectorAll("li svg path:first-child")].map((p) => p.getAttribute("fill"));
    expect(fills).toEqual([ACTIVITY_COLOR.IDLE, ACTIVITY_COLOR.TRANSIT, ACTIVITY_COLOR.WORKING]);
  });

  it("uses the same colours the map markers use", () => {
    expect(ACTIVITY_COLOR).toEqual({ IDLE: "#10b981", TRANSIT: "#f59e0b", WORKING: "#3b82f6" });
  });

  it("sits under the zoom controls and keeps the truck icons decorative", () => {
    const { container } = render(<FleetMapLegend />);
    expect(screen.getByRole("group")).toHaveClass("absolute", "left-2.5", "top-[5.25rem]");
    for (const svg of container.querySelectorAll("svg")) expect(svg).toHaveAttribute("aria-hidden", "true");
  });
});
