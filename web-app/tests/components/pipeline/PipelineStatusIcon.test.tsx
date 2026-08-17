import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { PipelineStatusIcon } from "../../../src/components/pipeline/PipelineStatusIcon";

describe("PipelineStatusIcon", () => {
  it("renders a check path for success", () => {
    const { container } = render(<PipelineStatusIcon category="success" />);
    expect(container.querySelector("path")).toBeInTheDocument();
    expect(container.querySelector("circle")).not.toBeInTheDocument();
  });

  it("renders an exclamation mark (line + dot) for failure", () => {
    const { container } = render(<PipelineStatusIcon category="failure" />);
    expect(container.querySelector("path")).toBeInTheDocument();
    expect(container.querySelector("circle")).toBeInTheDocument();
  });

  it("renders a spinning ring for inProgress", () => {
    const { container } = render(<PipelineStatusIcon category="inProgress" />);
    expect(container.querySelector("svg")).toHaveClass("animate-spin");
    expect(container.querySelector("circle")).toBeInTheDocument();
  });

  it("renders a dash for neutral", () => {
    const { container } = render(<PipelineStatusIcon category="neutral" />);
    expect(container.querySelector("path")).toBeInTheDocument();
    expect(container.querySelector("circle")).not.toBeInTheDocument();
  });

  it("applies the given style (currentColor pattern) and is decorative", () => {
    const { container } = render(<PipelineStatusIcon category="success" style={{ color: "#0ca30c" }} />);
    const svg = container.querySelector("svg");
    expect(svg).toHaveAttribute("aria-hidden", "true");
    expect(svg).toHaveStyle({ color: "#0ca30c" });
  });
});
