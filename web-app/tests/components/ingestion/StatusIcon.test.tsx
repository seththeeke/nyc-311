import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { StatusIcon } from "../../../src/components/ingestion/StatusIcon";

describe("StatusIcon", () => {
  it("renders a check path for success", () => {
    const { container } = render(<StatusIcon success />);
    expect(container.querySelector("path")).toBeInTheDocument();
    expect(container.querySelector("circle")).not.toBeInTheDocument();
  });

  it("renders an exclamation mark (line + dot) for failure", () => {
    const { container } = render(<StatusIcon success={false} />);
    expect(container.querySelector("path")).toBeInTheDocument();
    expect(container.querySelector("circle")).toBeInTheDocument();
  });

  it("is decorative — hidden from assistive tech, identity carried by aria-label elsewhere", () => {
    const { container } = render(<StatusIcon success />);
    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });
});
