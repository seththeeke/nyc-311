import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { FleetMapWidget } from "../../../src/components/widgets/FleetMapWidget";
import { useFleetLocations } from "../../../src/hooks/useFleetLocations";
import type { FleetLocations } from "../../../src/models/fleetLocation";

vi.mock("../../../src/hooks/useFleetLocations", () => ({ useFleetLocations: vi.fn() }));
vi.mock("../../../src/components/FleetMap", () => ({
  FleetMap: ({ operators }: { operators: unknown[] }) => <div data-testid="fleet-map">{operators.length} operators</div>,
}));

const mockedUseFleetLocations = vi.mocked(useFleetLocations);

const locations: FleetLocations = {
  operators: [
    { operator_id: "01A", name: "Truck A", current_activity: "IDLE", current_location: { lat: 40.71, lng: -74.0 }, recent_job_locations: [], current_order: null },
  ],
};

describe("FleetMapWidget", () => {
  it("renders the map immediately, before locations resolve", () => {
    mockedUseFleetLocations.mockReturnValue({ locations: undefined, isLoading: true, error: null });
    render(<FleetMapWidget />);
    expect(screen.getByTestId("fleet-map")).toHaveTextContent("0 operators");
  });

  it("overlays a loading indicator on top of the map, not in place of it", () => {
    mockedUseFleetLocations.mockReturnValue({ locations: undefined, isLoading: true, error: null });
    const { container } = render(<FleetMapWidget />);
    expect(screen.getByText("Loading fleet…")).toBeInTheDocument();
    expect(screen.getByTestId("fleet-map")).toBeInTheDocument();
    expect(container.querySelector("svg.animate-spin")).toBeInTheDocument();
  });

  it("shows the loading message large and centered over the map", () => {
    mockedUseFleetLocations.mockReturnValue({ locations: undefined, isLoading: true, error: null });
    render(<FleetMapWidget />);
    const message = screen.getByRole("status");
    expect(message).toHaveClass("text-3xl");
    expect(message.parentElement).toHaveClass("absolute", "inset-0", "flex", "items-center", "justify-center");
  });

  it("floats the status legend over the map, and keeps it visible while loading and on error", () => {
    mockedUseFleetLocations.mockReturnValue({ locations: undefined, isLoading: true, error: null });
    const { unmount } = render(<FleetMapWidget />);
    expect(screen.getByRole("group", { name: "Fleet status legend" })).toBeInTheDocument();
    unmount();
    mockedUseFleetLocations.mockReturnValue({ locations: undefined, isLoading: false, error: new Error("x") });
    render(<FleetMapWidget />);
    expect(screen.getByRole("group", { name: "Fleet status legend" })).toBeInTheDocument();
  });

  it("places the error message top-center so it doesn't sit on the zoom controls or legend", () => {
    mockedUseFleetLocations.mockReturnValue({ locations: undefined, isLoading: false, error: new Error("HTTP 500") });
    render(<FleetMapWidget />);
    expect(screen.getByRole("alert")).toHaveClass("left-1/2", "-translate-x-1/2");
  });

  it("overlays an error message when fetching fails, without hiding the map", () => {
    mockedUseFleetLocations.mockReturnValue({ locations: undefined, isLoading: false, error: new Error("HTTP 500") });
    render(<FleetMapWidget />);
    expect(screen.getByRole("alert")).toHaveTextContent("HTTP 500");
    expect(screen.getByTestId("fleet-map")).toBeInTheDocument();
  });

  it("passes the resolved operators to the map once locations load", () => {
    mockedUseFleetLocations.mockReturnValue({ locations, isLoading: false, error: null });
    const { container } = render(<FleetMapWidget />);
    expect(screen.getByTestId("fleet-map")).toHaveTextContent("1 operators");
    expect(screen.queryByText("Loading fleet…")).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(container.querySelector("svg.animate-spin")).not.toBeInTheDocument();
  });
});
