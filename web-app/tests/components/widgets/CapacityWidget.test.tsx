import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { CapacityWidget } from "../../../src/components/widgets/CapacityWidget";
import { useFleetLocations } from "../../../src/hooks/useFleetLocations";
import type { FleetLocations } from "../../../src/models/fleetLocation";

vi.mock("../../../src/hooks/useFleetLocations", () => ({ useFleetLocations: vi.fn() }));
const mockedUseFleetLocations = vi.mocked(useFleetLocations);

function withOperators(count: number): FleetLocations {
  return {
    operators: Array.from({ length: count }, (_, i) => ({
      operator_id: `0${i}`,
      name: `Truck ${i}`,
      current_activity: "IDLE" as const,
      current_location: { lat: 40.7, lng: -74 },
      recent_job_locations: [],
      current_order: null,
    })),
  };
}

describe("CapacityWidget", () => {
  it("shows the operator count once loaded", () => {
    mockedUseFleetLocations.mockReturnValue({ locations: withOperators(7), isLoading: false, error: null });
    render(<CapacityWidget />);
    expect(screen.getByText("7")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveAccessibleName("Total capacity: 7 operators");
  });

  it("shows zero explicitly rather than a placeholder", () => {
    mockedUseFleetLocations.mockReturnValue({ locations: withOperators(0), isLoading: false, error: null });
    render(<CapacityWidget />);
    expect(screen.getByText("0")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveAccessibleName("Total capacity: 0 operators");
  });

  it("shows a placeholder and loading name while unresolved", () => {
    mockedUseFleetLocations.mockReturnValue({ locations: undefined, isLoading: true, error: null });
    render(<CapacityWidget />);
    expect(screen.getByText("—")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveAccessibleName("Total capacity: loading");
  });
});
