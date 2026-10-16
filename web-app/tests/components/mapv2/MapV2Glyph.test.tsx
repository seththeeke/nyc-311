import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { MapV2Glyph } from "../../../src/components/mapv2/MapV2Glyph";

describe("MapV2Glyph", () => {
  it("renders a decorative svg with the glyph's paths and a default size", () => {
    const { container } = render(<MapV2Glyph name="ROTATE_LEFT" />);
    const svg = container.querySelector("svg")!;
    expect(svg).toHaveAttribute("aria-hidden", "true");
    expect(svg).toHaveClass("h-4 w-4");
    expect(svg.querySelectorAll("path")).toHaveLength(2);
  });

  it("accepts a custom class", () => {
    const { container } = render(<MapV2Glyph name="CLOSE" className="h-8 w-8" />);
    expect(container.querySelector("svg")).toHaveClass("h-8 w-8");
  });
});
