import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { IngestionMonitoringPage } from "../../../src/components/pages/IngestionMonitoringPage";

describe("IngestionMonitoringPage", () => {
  it("shows a coming-soon placeholder and a link back to Monitoring", () => {
    render(
      <MemoryRouter>
        <IngestionMonitoringPage />
      </MemoryRouter>
    );

    expect(screen.getByRole("heading", { name: "Ingestion" })).toBeInTheDocument();
    expect(screen.getByText("Coming soon.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /monitoring/i })).toHaveAttribute("href", "/monitoring");
  });
});
