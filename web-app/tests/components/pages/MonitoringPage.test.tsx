import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { MonitoringPage } from "../../../src/components/pages/MonitoringPage";

describe("MonitoringPage", () => {
  it("renders an Ingestion tile linking to /monitoring/ingestion", () => {
    render(
      <MemoryRouter>
        <MonitoringPage />
      </MemoryRouter>
    );

    expect(screen.getByRole("heading", { name: "Monitoring" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /ingestion/i })).toHaveAttribute(
      "href",
      "/monitoring/ingestion"
    );
  });

  it("renders a Pipeline tile linking to /monitoring/pipeline", () => {
    render(
      <MemoryRouter>
        <MonitoringPage />
      </MemoryRouter>
    );

    expect(screen.getByRole("link", { name: /pipeline/i })).toHaveAttribute(
      "href",
      "/monitoring/pipeline"
    );
  });
});
