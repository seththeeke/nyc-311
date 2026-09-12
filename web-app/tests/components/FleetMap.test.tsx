import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { FleetMap } from "../../src/components/FleetMap";
import type { FleetOperatorLocation } from "../../src/models/fleetLocation";

/*
 * react-leaflet's MapContainer manipulates real DOM layout/canvas APIs
 * happy-dom doesn't fully implement — mocked to simple stand-ins so this
 * test can assert on what FleetMap passes it, not exercise Leaflet itself
 * (that's what the browser check is for).
 */
vi.mock("react-leaflet", () => ({
  MapContainer: ({ children }: { children: React.ReactNode }) => <div data-testid="map-container">{children}</div>,
  TileLayer: () => <div data-testid="tile-layer" />,
  CircleMarker: ({ children, center, pathOptions }: { children: React.ReactNode; center: [number, number]; pathOptions: { color: string } }) => (
    <div data-testid="circle-marker" data-center={center.join(",")} data-color={pathOptions.color}>
      {children}
    </div>
  ),
  Popup: ({ children }: { children: React.ReactNode }) => <div data-testid="popup">{children}</div>,
}));

const operators: FleetOperatorLocation[] = [
  { operator_id: "01A", name: "Truck A", current_activity: "IDLE", current_location: { lat: 40.71, lng: -74.0 } },
  { operator_id: "01B", name: "Truck B", current_activity: "WORKING", current_location: { lat: 40.72, lng: -73.9 } },
  { operator_id: "01C", name: "Truck C", current_activity: "TRANSIT", current_location: null },
];

describe("FleetMap", () => {
  it("renders one marker per plottable Operator, skipping one with no current_location", () => {
    render(<FleetMap operators={operators} />);

    expect(screen.getAllByTestId("circle-marker")).toHaveLength(2);
  });

  it("plots each marker at the Operator's current_location", () => {
    render(<FleetMap operators={operators} />);

    const markers = screen.getAllByTestId("circle-marker");
    expect(markers[0]).toHaveAttribute("data-center", "40.71,-74");
    expect(markers[1]).toHaveAttribute("data-center", "40.72,-73.9");
  });

  it("colors markers by activity", () => {
    render(<FleetMap operators={operators} />);

    const markers = screen.getAllByTestId("circle-marker");
    expect(markers[0]).toHaveAttribute("data-color", "#10b981");
    expect(markers[1]).toHaveAttribute("data-color", "#3b82f6");
  });

  it("labels each popup with the Operator's name and activity", () => {
    render(<FleetMap operators={operators} />);

    expect(screen.getByText("Truck A")).toBeInTheDocument();
    expect(screen.getByText("Truck B")).toBeInTheDocument();
  });

  it("renders no markers for an empty roster", () => {
    render(<FleetMap operators={[]} />);

    expect(screen.queryByTestId("circle-marker")).not.toBeInTheDocument();
  });
});
