import type { ReactElement } from "react";
import { CircleMarker, MapContainer, Popup, TileLayer } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import type { FleetOperatorLocation, GpsLocation, OperatorActivity } from "../models/fleetLocation";

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
 * §6.1) — a live, read-only view of every active Operator's current GPS
 * position, color-coded by activity. Current position only, no path/trail
 * rendering yet (deliberately rudimentary — a first visual way to verify
 * scheduling/execution actually moves vehicles around).
 */
export function FleetMap({ operators }: FleetMapProps): ReactElement {
  const plottable = operators.filter(isPlottable);

  return (
    <div className="overflow-hidden rounded-2xl border border-white/10">
      <MapContainer center={NYC_CENTER} zoom={DEFAULT_ZOOM} scrollWheelZoom={false} style={{ height: "28rem", width: "100%" }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {plottable.map((operator) => (
          <CircleMarker
            key={operator.operator_id}
            center={[operator.current_location.lat, operator.current_location.lng]}
            radius={8}
            pathOptions={{ color: ACTIVITY_COLOR[operator.current_activity], fillOpacity: 0.8 }}
          >
            <Popup>
              <strong>{operator.name}</strong>
              <br />
              {operator.current_activity}
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>
    </div>
  );
}
