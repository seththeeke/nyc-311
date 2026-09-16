import type { ReactElement } from "react";
import { MapContainer, TileLayer } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import type { FleetOperatorLocation, GpsLocation, OperatorActivity } from "../models/fleetLocation";
import { OperatorTrail } from "./OperatorTrail";

interface FleetMapProps {
  operators: FleetOperatorLocation[];
}

type PlottableOperator = FleetOperatorLocation & { current_location: GpsLocation };

function isPlottable(operator: FleetOperatorLocation): operator is PlottableOperator {
  return operator.current_location !== null;
}

/* Literal strings, not built from a template — see MonitoringTile.tsx's identical note on Tailwind's static scanner. */
const ACTIVITY_COLOR: Record<OperatorActivity, string> = {
  IDLE: "#10b981",
  TRANSIT: "#f59e0b",
  WORKING: "#3b82f6",
};

const NYC_CENTER: [number, number] = [40.7128, -74.006];
const DEFAULT_ZOOM = 11;

/**
 * The home-page fleet map (`10-capacity-modeling-and-integration.md`
 * §6.1, truck icons + path trails added by
 * `11-street-condition-implementation.md` §7) — every active Operator's
 * current GPS position, color-coded by activity, with a fading trail
 * through its last up to 5 completed jobs. Fills its parent's height/
 * width. Always renders, even with an empty roster.
 */
export function FleetMap({ operators }: FleetMapProps): ReactElement {
  const plottable = operators.filter(isPlottable);

  return (
    <MapContainer center={NYC_CENTER} zoom={DEFAULT_ZOOM} scrollWheelZoom style={{ height: "100%", width: "100%" }}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {plottable.map((operator) => (
        <OperatorTrail
          key={operator.operator_id}
          name={operator.name}
          activity={operator.current_activity}
          color={ACTIVITY_COLOR[operator.current_activity]}
          currentLocation={operator.current_location}
          recentJobLocations={operator.recent_job_locations}
        />
      ))}
    </MapContainer>
  );
}
