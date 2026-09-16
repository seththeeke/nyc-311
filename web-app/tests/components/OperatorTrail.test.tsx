import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { OperatorTrail } from "../../src/components/OperatorTrail";

/* Same rationale as FleetMap.test.tsx — stand in for react-leaflet primitives happy-dom can't fully render. */
vi.mock("react-leaflet", () => ({
  Marker: ({ children, position, icon }: { children: React.ReactNode; position: [number, number]; icon: { options: { html: string } } }) => (
    <div data-testid="marker" data-position={position.join(",")} data-icon-html={icon.options.html}>
      {children}
    </div>
  ),
  Polyline: ({ positions, pathOptions }: { positions: [number, number][][]; pathOptions: { color: string; opacity: number } }) => (
    <div
      data-testid="polyline"
      data-positions={JSON.stringify(positions)}
      data-color={pathOptions.color}
      data-opacity={pathOptions.opacity}
    />
  ),
  Popup: ({ children }: { children: React.ReactNode }) => <div data-testid="popup">{children}</div>,
}));

const CURRENT_LOCATION = { lat: 40.71, lng: -74.0 };
const RECENT_JOBS = [
  { lat: 40.72, lng: -73.9 },
  { lat: 40.73, lng: -73.8 },
];

describe("OperatorTrail", () => {
  it("renders a Marker at the Operator's current position", () => {
    render(<OperatorTrail name="Truck A" activity="IDLE" color="#10b981" currentLocation={CURRENT_LOCATION} recentJobLocations={[]} />);

    expect(screen.getByTestId("marker")).toHaveAttribute("data-position", "40.71,-74");
  });

  it("labels the popup with the Operator's name and activity", () => {
    render(<OperatorTrail name="Truck A" activity="WORKING" color="#3b82f6" currentLocation={CURRENT_LOCATION} recentJobLocations={[]} />);

    expect(screen.getByText("Truck A")).toBeInTheDocument();
    expect(screen.getByText("WORKING")).toBeInTheDocument();
  });

  it("bakes the activity color into the truck icon's inline SVG", () => {
    render(<OperatorTrail name="Truck A" activity="IDLE" color="#10b981" currentLocation={CURRENT_LOCATION} recentJobLocations={[]} />);

    expect(screen.getByTestId("marker")).toHaveAttribute("data-icon-html", expect.stringContaining("#10b981"));
  });

  it("renders no trail segments for an Operator with no recent jobs", () => {
    render(<OperatorTrail name="Truck A" activity="IDLE" color="#10b981" currentLocation={CURRENT_LOCATION} recentJobLocations={[]} />);

    expect(screen.queryByTestId("polyline")).not.toBeInTheDocument();
  });

  it("draws one segment per recent job, current position through each job in order", () => {
    render(<OperatorTrail name="Truck A" activity="IDLE" color="#10b981" currentLocation={CURRENT_LOCATION} recentJobLocations={RECENT_JOBS} />);

    const segments = screen.getAllByTestId("polyline");
    expect(segments).toHaveLength(2);
    expect(JSON.parse(segments[0].getAttribute("data-positions") ?? "[]")).toEqual([
      [CURRENT_LOCATION.lat, CURRENT_LOCATION.lng],
      [RECENT_JOBS[0].lat, RECENT_JOBS[0].lng],
    ]);
    expect(JSON.parse(segments[1].getAttribute("data-positions") ?? "[]")).toEqual([
      [RECENT_JOBS[0].lat, RECENT_JOBS[0].lng],
      [RECENT_JOBS[1].lat, RECENT_JOBS[1].lng],
    ]);
  });

  it("fades segment opacity from 1.0 nearest-current down through older jobs", () => {
    const fiveJobs = [
      { lat: 1, lng: 1 },
      { lat: 2, lng: 2 },
      { lat: 3, lng: 3 },
      { lat: 4, lng: 4 },
      { lat: 5, lng: 5 },
    ];
    render(<OperatorTrail name="Truck A" activity="IDLE" color="#10b981" currentLocation={CURRENT_LOCATION} recentJobLocations={fiveJobs} />);

    const segments = screen.getAllByTestId("polyline");
    expect(segments.map((s) => s.getAttribute("data-opacity"))).toEqual(["1", "0.8", "0.6", "0.4", "0.2"]);
  });

  it("colors every trail segment the same as the marker", () => {
    render(<OperatorTrail name="Truck A" activity="IDLE" color="#f59e0b" currentLocation={CURRENT_LOCATION} recentJobLocations={RECENT_JOBS} />);

    for (const segment of screen.getAllByTestId("polyline")) {
      expect(segment).toHaveAttribute("data-color", "#f59e0b");
    }
  });
});
