import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { WebGlFallback } from "../../../src/components/mapv2/WebGlFallback";

describe("WebGlFallback", () => {
  it("explains the problem and links to the classic map", () => {
    render(
      <MemoryRouter>
        <WebGlFallback />
      </MemoryRouter>
    );
    expect(screen.getByRole("heading", { name: "3-D map unavailable" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open the classic map" })).toHaveAttribute("href", "/");
  });
});
