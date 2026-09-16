import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { FleetMap } from "../../src/components/FleetMap";
import type { FleetOperatorLocation } from "../../src/models/fleetLocation";

/*
 * react-leaflet's MapContainer manipulates real DOM layout/canvas APIs
 * happy-dom doesn't fully implement — mocked to simple stand-ins so this
 * test can assert on what FleetMap passes down, not exercise Leaflet
 * itself (that's what the browser check is for). OperatorTrail's own
 * marker/trail rendering is covered by its own test file — mocked here to
 * a stand-in that surfaces the props FleetMap passed it.
 */
vi.mock("react-leaflet", () => ({
  MapContainer: ({ children }: { children: React.ReactNode }) => <div data-testid="map-container">{children}</div>,
  TileLayer: () => <div data-testid="tile-layer" />,
}));

vi.mock("../../src/components/OperatorTrail", () => ({
  OperatorTrail: ({
    name,
    activity,
    color,
    currentLocation,
    recentJobLocations,
    currentOrder,
  }: {
    name: string;
    activity: string;
    color: string;
    currentLocation: { lat: number; lng: number };
    recentJobLocations: { lat: number; lng: number }[];
    currentOrder: { order_id: string } | null;
  }) => (
    <div
      data-testid="operator-trail"
      data-name={name}
      data-activity={activity}
      data-color={color}
      data-current={`${currentLocation.lat},${currentLocation.lng}`}
      data-recent-count={recentJobLocations.length}
      data-current-order-id={currentOrder?.order_id ?? ""}
    />
  ),
}));

const operators: FleetOperatorLocation[] = [
  { operator_id: "01A", name: "Truck A", current_activity: "IDLE", current_location: { lat: 40.71, lng: -74.0 }, recent_job_locations: [], current_order: null },
  {
    operator_id: "01B",
    name: "Truck B",
    current_activity: "WORKING",
    current_location: { lat: 40.72, lng: -73.9 },
    recent_job_locations: [{ lat: 40.7, lng: -73.8 }],
    current_order: { order_id: "01ORDER", complaint_type: "Street Condition", location_address: "123 Main St" },
  },
  { operator_id: "01C", name: "Truck C", current_activity: "TRANSIT", current_location: null, recent_job_locations: [], current_order: null },
];

describe("FleetMap", () => {
  it("renders one OperatorTrail per plottable Operator, skipping one with no current_location", () => {
    render(<FleetMap operators={operators} />);

    expect(screen.getAllByTestId("operator-trail")).toHaveLength(2);
  });

  it("passes each Operator's current_location through to its trail", () => {
    render(<FleetMap operators={operators} />);

    const trails = screen.getAllByTestId("operator-trail");
    expect(trails[0]).toHaveAttribute("data-current", "40.71,-74");
    expect(trails[1]).toHaveAttribute("data-current", "40.72,-73.9");
  });

  it("colors each trail by activity", () => {
    render(<FleetMap operators={operators} />);

    const trails = screen.getAllByTestId("operator-trail");
    expect(trails[0]).toHaveAttribute("data-color", "#10b981");
    expect(trails[1]).toHaveAttribute("data-color", "#3b82f6");
  });

  it("passes each Operator's recent_job_locations through to its trail", () => {
    render(<FleetMap operators={operators} />);

    const trails = screen.getAllByTestId("operator-trail");
    expect(trails[0]).toHaveAttribute("data-recent-count", "0");
    expect(trails[1]).toHaveAttribute("data-recent-count", "1");
  });

  it("passes each Operator's name and activity through to its trail", () => {
    render(<FleetMap operators={operators} />);

    const trails = screen.getAllByTestId("operator-trail");
    expect(trails[0]).toHaveAttribute("data-name", "Truck A");
    expect(trails[0]).toHaveAttribute("data-activity", "IDLE");
    expect(trails[1]).toHaveAttribute("data-name", "Truck B");
    expect(trails[1]).toHaveAttribute("data-activity", "WORKING");
  });

  it("passes each Operator's current_order through to its trail", () => {
    render(<FleetMap operators={operators} />);

    const trails = screen.getAllByTestId("operator-trail");
    expect(trails[0]).toHaveAttribute("data-current-order-id", "");
    expect(trails[1]).toHaveAttribute("data-current-order-id", "01ORDER");
  });

  it("renders no trails for an empty roster", () => {
    render(<FleetMap operators={[]} />);

    expect(screen.queryByTestId("operator-trail")).not.toBeInTheDocument();
  });
});
