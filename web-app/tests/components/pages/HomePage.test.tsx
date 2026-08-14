import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { HomePage } from "../../../src/components/pages/HomePage";

describe("HomePage", () => {
  it("links to the monitoring section", () => {
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>
    );

    expect(screen.getByRole("link", { name: /view system monitoring/i })).toHaveAttribute(
      "href",
      "/monitoring"
    );
  });
});
