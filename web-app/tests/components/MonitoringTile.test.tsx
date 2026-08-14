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
});
