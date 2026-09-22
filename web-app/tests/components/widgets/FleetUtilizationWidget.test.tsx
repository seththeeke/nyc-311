import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { FleetUtilizationWidget } from "../../../src/components/widgets/FleetUtilizationWidget";
import { useFleetLocations } from "../../../src/hooks/useFleetLocations";
import type { FleetLocations, FleetOperatorLocation } from "../../../src/models/fleetLocation";

vi.mock("../../../src/hooks/useFleetLocations", () => ({ useFleetLocations: vi.fn() }));
const mockedUseFleetLocations = vi.mocked(useFleetLocations);

function operator(activity: FleetOperatorLocation["current_activity"]): FleetOperatorLocation {
  return {
    operator_id: activity,
    name: "Truck",
    current_activity: activity,
    current_location: null,
    recent_job_locations: [],
    current_order: null,
  };
}

function fleet(...activities: FleetOperatorLocation["current_activity"][]): FleetLocations {
  return { operators: activities.map(operator) };
}

describe("FleetUtilizationWidget", () => {
  it("computes shares from the fetched fleet's current_activity, no separate call", () => {
    mockedUseFleetLocations.mockReturnValue({
      locations: fleet("WORKING", "WORKING", "TRANSIT", "IDLE"),
      isLoading: false,
      error: null,
    });
    render(<FleetUtilizationWidget />);
    expect(screen.getByRole("img")).toHaveAccessibleName("Fleet utilization: Working 50%, In transit 25%, Idle 25%");
    expect(screen.getByText("Working")).toBeInTheDocument();
    expect(screen.getByText("50%")).toBeInTheDocument();
  });

  it("always shows all three activities, even at 0%, so the legend doesn't reshuffle", () => {
    mockedUseFleetLocations.mockReturnValue({ locations: fleet("WORKING", "WORKING"), isLoading: false, error: null });
    render(<FleetUtilizationWidget />);
    expect(screen.getByRole("img")).toHaveAccessibleName("Fleet utilization: Working 100%, In transit 0%, Idle 0%");
    expect(screen.getByText("In transit")).toBeInTheDocument();
    expect(screen.getByText("Idle")).toBeInTheDocument();
  });

  it("shows a loading state, an error state, and an empty-roster state", () => {
    mockedUseFleetLocations.mockReturnValue({ locations: undefined, isLoading: true, error: null });
    const { rerender } = render(<FleetUtilizationWidget />);
    expect(screen.getByText("Loading…")).toBeInTheDocument();

    mockedUseFleetLocations.mockReturnValue({ locations: undefined, isLoading: false, error: new Error("HTTP 500") });
    rerender(<FleetUtilizationWidget />);
    expect(screen.getByRole("alert")).toHaveTextContent("Fleet data unavailable.");

    mockedUseFleetLocations.mockReturnValue({ locations: fleet(), isLoading: false, error: null });
    rerender(<FleetUtilizationWidget />);
    expect(screen.getByText("No active operators.")).toBeInTheDocument();
  });

  it("gives each segment a hover title", () => {
    mockedUseFleetLocations.mockReturnValue({ locations: fleet("WORKING", "IDLE"), isLoading: false, error: null });
    const { container } = render(<FleetUtilizationWidget />);
    expect([...container.querySelectorAll('[role="img"] > div')].map((el) => el.getAttribute("title"))).toEqual([
      "Working: 50%",
      "In transit: 0%",
      "Idle: 50%",
    ]);
  });

  it("treats an undefined locations result (query resolved with no data yet) as an empty fleet, not a crash", () => {
    mockedUseFleetLocations.mockReturnValue({ locations: undefined, isLoading: false, error: null });
    render(<FleetUtilizationWidget />);
    expect(screen.getByText("No active operators.")).toBeInTheDocument();
  });
});
