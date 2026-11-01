import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { MapGlyph } from "../../../src/components/map/MapGlyph";

describe("MapGlyph", () => {
  it("renders a decorative svg with the glyph's paths and a default size", () => {
    const { container } = render(<MapGlyph name="ROTATE_LEFT" />);
    const svg = container.querySelector("svg")!;
    expect(svg).toHaveAttribute("aria-hidden", "true");
    expect(svg).toHaveClass("h-4 w-4");
    expect(svg.querySelectorAll("path")).toHaveLength(2);
  });

  it("accepts a custom class", () => {
    const { container } = render(<MapGlyph name="CLOSE" className="h-8 w-8" />);
    expect(container.querySelector("svg")).toHaveClass("h-8 w-8");
  });
});
