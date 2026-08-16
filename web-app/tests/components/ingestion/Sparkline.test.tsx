import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { Sparkline } from "../../../src/components/ingestion/Sparkline";

describe("Sparkline", () => {
  it("renders nothing for fewer than two points", () => {
    const { container: empty } = render(<Sparkline values={[]} />);
    expect(empty.querySelector("svg")).not.toBeInTheDocument();

    const { container: single } = render(<Sparkline values={[5]} />);
    expect(single.querySelector("svg")).not.toBeInTheDocument();
  });

  it("renders a polyline and accent dot for two or more points", () => {
    const { container } = render(<Sparkline values={[10, 20, 5]} />);
    expect(container.querySelector("polyline")).toBeInTheDocument();
    expect(container.querySelector("circle")).toBeInTheDocument();
  });

  it("handles a flat series (zero range) without dividing by zero", () => {
    const { container } = render(<Sparkline values={[7, 7, 7]} />);
    const polyline = container.querySelector("polyline");
    expect(polyline).toBeInTheDocument();
    expect(polyline?.getAttribute("points")).not.toContain("NaN");
  });

  it("accepts a custom accent color for the current-period dot", () => {
    const { container } = render(<Sparkline values={[1, 2]} accentColor="#123456" />);
    expect(container.querySelector("circle")).toHaveAttribute("fill", "#123456");
  });
});
