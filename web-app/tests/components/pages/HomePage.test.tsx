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
  it("renders no title or nav of its own — the global Header already carries those", () => {
    mockedUseFleetLocations.mockReturnValue({ locations: undefined, isLoading: true, error: null });

    renderHomePage();

    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("renders the map immediately, before locations resolve", () => {
    mockedUseFleetLocations.mockReturnValue({ locations: undefined, isLoading: true, error: null });

    renderHomePage();

    expect(screen.getByTestId("fleet-map")).toHaveTextContent("0 operators");
  });

  it("overlays a loading indicator on top of the map, not in place of it", () => {
    mockedUseFleetLocations.mockReturnValue({ locations: undefined, isLoading: true, error: null });

    renderHomePage();

    expect(screen.getByText("Loading fleet…")).toBeInTheDocument();
    expect(screen.getByTestId("fleet-map")).toBeInTheDocument();
  });

  it("overlays an error message on top of the map when fetching fails, without hiding the map", () => {
    mockedUseFleetLocations.mockReturnValue({ locations: undefined, isLoading: false, error: new Error("HTTP 500") });

    renderHomePage();

    expect(screen.getByRole("alert")).toHaveTextContent("HTTP 500");
    expect(screen.getByTestId("fleet-map")).toBeInTheDocument();
  });

  it("passes the resolved operators to the map once locations load", () => {
    mockedUseFleetLocations.mockReturnValue({ locations, isLoading: false, error: null });

    renderHomePage();

    expect(screen.getByTestId("fleet-map")).toHaveTextContent("1 operators");
    expect(screen.queryByText("Loading fleet…")).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
