import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { HomePage } from "../../../src/components/pages/HomePage";
import { useFleetLocations } from "../../../src/hooks/useFleetLocations";
import type { FleetLocations } from "../../../src/models/fleetLocation";

vi.mock("../../../src/hooks/useFleetLocations", () => ({ useFleetLocations: vi.fn() }));
vi.mock("../../../src/components/FleetMap", () => ({
  FleetMap: ({ operators }: { operators: unknown[] }) => <div data-testid="fleet-map">{operators.length} operators</div>,
}));

const mockedUseFleetLocations = vi.mocked(useFleetLocations);

const locations: FleetLocations = {
  operators: [{ operator_id: "01A", name: "Truck A", current_activity: "IDLE", current_location: { lat: 40.71, lng: -74.0 } }],
};

function renderHomePage() {
  return render(
    <MemoryRouter>
      <HomePage />
    </MemoryRouter>
  );
}

describe("HomePage", () => {
  it("shows the BoroughSim product name as the heading", () => {
    mockedUseFleetLocations.mockReturnValue({ locations: undefined, isLoading: true, error: null });

    renderHomePage();

    expect(screen.getByRole("heading", { name: "BoroughSim" })).toBeInTheDocument();
  });

  it("links to the monitoring section", () => {
    mockedUseFleetLocations.mockReturnValue({ locations: undefined, isLoading: true, error: null });

    renderHomePage();

    expect(screen.getByRole("link", { name: /view system monitoring/i })).toHaveAttribute("href", "/monitoring");
  });

  it("does not link straight to the data warehouse — that moved to a Monitoring tile", () => {
    mockedUseFleetLocations.mockReturnValue({ locations: undefined, isLoading: true, error: null });

    renderHomePage();

    expect(screen.queryByRole("link", { name: /data warehouse/i })).not.toBeInTheDocument();
  });

  it("shows a loading state before fleet locations resolve", () => {
    mockedUseFleetLocations.mockReturnValue({ locations: undefined, isLoading: true, error: null });

    renderHomePage();

    expect(screen.getByText("Loading…")).toBeInTheDocument();
  });

  it("shows an error state when fetching fleet locations fails", () => {
    mockedUseFleetLocations.mockReturnValue({ locations: undefined, isLoading: false, error: new Error("HTTP 500") });

    renderHomePage();

    expect(screen.getByRole("alert")).toHaveTextContent("HTTP 500");
  });

  it("renders the FleetMap once locations resolve", () => {
    mockedUseFleetLocations.mockReturnValue({ locations, isLoading: false, error: null });

    renderHomePage();

    expect(screen.getByTestId("fleet-map")).toHaveTextContent("1 operators");
  });
});
