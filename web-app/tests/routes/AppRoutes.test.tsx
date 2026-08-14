import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AppRoutes } from "../../src/routes/AppRoutes";

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AppRoutes />
    </MemoryRouter>
  );
}

describe("AppRoutes", () => {
  it("renders HomePage at /", () => {
    renderAt("/");
    expect(screen.getByRole("heading", { name: "NYC 311" })).toBeInTheDocument();
  });

  it("renders MonitoringPage at /monitoring", () => {
    renderAt("/monitoring");
    expect(screen.getByRole("heading", { name: "Monitoring" })).toBeInTheDocument();
  });

  it("renders IngestionMonitoringPage at /monitoring/ingestion", () => {
    renderAt("/monitoring/ingestion");
    expect(screen.getByRole("heading", { name: "Ingestion" })).toBeInTheDocument();
  });
});
