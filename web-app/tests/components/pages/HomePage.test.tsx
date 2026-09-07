import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { HomePage } from "../../../src/components/pages/HomePage";

describe("HomePage", () => {
  it("shows the BoroughSim product name as the heading", () => {
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>
    );

    expect(screen.getByRole("heading", { name: "BoroughSim" })).toBeInTheDocument();
  });

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

  it("does not link straight to the data warehouse — that moved to a Monitoring tile", () => {
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>
    );

    expect(screen.queryByRole("link", { name: /data warehouse/i })).not.toBeInTheDocument();
  });
});
