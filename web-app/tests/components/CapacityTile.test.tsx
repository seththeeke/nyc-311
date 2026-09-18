import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { CapacityTile } from "../../src/components/CapacityTile";

describe("CapacityTile", () => {
  it("shows the operator count and label once loaded", () => {
    render(<CapacityTile count={7} />);

    expect(screen.getByText("7")).toBeInTheDocument();
    expect(screen.getByText("Capacity")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveAccessibleName("Total capacity: 7 operators");
  });

  it("shows zero explicitly rather than falling back to a placeholder", () => {
    render(<CapacityTile count={0} />);

    expect(screen.getByText("0")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveAccessibleName("Total capacity: 0 operators");
  });

  it("shows a placeholder and a loading accessible name while the count is unresolved", () => {
    render(<CapacityTile count={null} />);

    expect(screen.getByText("—")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveAccessibleName("Total capacity: loading");
  });
});
