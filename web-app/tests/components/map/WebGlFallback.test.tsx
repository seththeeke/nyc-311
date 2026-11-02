import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { WebGlFallback } from "../../../src/components/map/WebGlFallback";

describe("WebGlFallback", () => {
  it("explains the problem, with no link to a map that isn't there", () => {
    render(<WebGlFallback />);
    expect(screen.getByRole("heading", { name: "3-D map unavailable" })).toBeInTheDocument();
    expect(screen.getByText(/needs WebGL2/)).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});
