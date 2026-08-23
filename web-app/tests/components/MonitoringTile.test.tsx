import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { MonitoringTile } from "../../src/components/MonitoringTile";

describe("MonitoringTile", () => {
  it("renders the title, description, and link target", () => {
    render(
      <MemoryRouter>
        <MonitoringTile title="Ingestion" description="Poller run history." to="/monitoring/ingestion" />
      </MemoryRouter>
    );

    expect(screen.getByRole("heading", { name: "Ingestion" })).toBeInTheDocument();
    expect(screen.getByText("Poller run history.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /ingestion/i })).toHaveAttribute(
      "href",
      "/monitoring/ingestion"
    );
  });

  it("renders an external link that opens in a new tab when external is true", () => {
    render(
      <MemoryRouter>
        <MonitoringTile
          title="Test Coverage"
          description="Hosted coverage reports."
          to="/coverage/index.html"
          external
        />
      </MemoryRouter>
    );

    const link = screen.getByRole("link", { name: /test coverage/i });
    expect(link).toHaveAttribute("href", "/coverage/index.html");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("renders an internal React Router link when external is not set", () => {
    render(
      <MemoryRouter>
        <MonitoringTile title="Ingestion" description="Poller run history." to="/monitoring/ingestion" />
      </MemoryRouter>
    );

    const link = screen.getByRole("link", { name: /ingestion/i });
    expect(link).not.toHaveAttribute("target");
  });
});
