import type { ReactElement } from "react";
import { divIcon, type DivIcon } from "leaflet";
import { CircleMarker, Marker, Polyline, Popup } from "react-leaflet";
import type { FleetCurrentOrder, GpsLocation, OperatorActivity } from "../models/fleetLocation";

interface OperatorTrailProps {
  name: string;
  activity: OperatorActivity;
  color: string;
  currentLocation: GpsLocation;
  recentJobLocations: GpsLocation[];
  currentOrder: FleetCurrentOrder | null;
  isSelected: boolean;
  onSelect: () => void;
}

const ICON_SIZE = 24;

/* Overrides the activity color for a clicked Operator's trail, so it stands out from the rest of the fleet. */
const SELECTED_TRAIL_COLOR = "#dc2626";

/* Most-recent-completed-job segment first, fading toward the oldest — 11-street-condition-implementation.md §7's "even linear steps". */
const SEGMENT_OPACITIES = [1.0, 0.8, 0.6, 0.4, 0.2];

/* A filled dot at each past stop, sized/outlined to read clearly against the line segments alone. */
const STOP_RADIUS = 5;
const STOP_STROKE_COLOR = "#1f2937";

/* Inline SVG via divIcon, no image asset/CDN dependency — fill matches the existing IDLE/TRANSIT/WORKING color coding. */
function truckIcon(color: string): DivIcon {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${ICON_SIZE}" height="${ICON_SIZE}">
    <path d="M2 7h12v8H2z" fill="${color}" stroke="#1f2937" stroke-width="1" />
    <path d="M14 11h4l4 3v1h-8z" fill="${color}" stroke="#1f2937" stroke-width="1" />
    <circle cx="6" cy="18" r="2" fill="#1f2937" />
    <circle cx="18" cy="18" r="2" fill="#1f2937" />
  </svg>`;
  return divIcon({ html: svg, className: "", iconSize: [ICON_SIZE, ICON_SIZE], iconAnchor: [ICON_SIZE / 2, ICON_SIZE / 2] });
}

/**
 * One Operator's truck marker plus its fading path trail through the last
 * up to 5 completed jobs (`11-street-condition-implementation.md` §7),
 * extracted out of `FleetMap.tsx` to keep it under the 200-line cap. Each
 * past stop also gets a filled circle marker, faded like its segment.
 * Straight-line segments, not a real road path — §3's routing is still
 * deferred. The popup shows the Order being executed, if any. Clicking
 * the marker calls `onSelect`, which turns this Operator's trail red.
 */
export function OperatorTrail({
  name,
  activity,
  color,
  currentLocation,
  recentJobLocations,
  currentOrder,
  isSelected,
  onSelect,
}: OperatorTrailProps): ReactElement {
  const trailPoints = [currentLocation, ...recentJobLocations];
  const trailColor = isSelected ? SELECTED_TRAIL_COLOR : color;

  return (
    <>
      <Marker position={[currentLocation.lat, currentLocation.lng]} icon={truckIcon(color)} eventHandlers={{ click: onSelect }}>
        <Popup>
          <strong>{name}</strong>
          <br />
          {activity}
          {currentOrder && (
            <>
              <hr />
              Order: {currentOrder.order_id}
              <br />
              Complaint: {currentOrder.complaint_type ?? "Unknown"}
              <br />
              Location: {currentOrder.location_address ?? "Unknown"}
            </>
          )}
        </Popup>
      </Marker>
      {trailPoints.slice(1).map((point, index) => {
        const previousPoint = trailPoints[index];
        return (
          <Polyline
            key={`${point.lat},${point.lng},${index}`}
            positions={[
              [previousPoint.lat, previousPoint.lng],
              [point.lat, point.lng],
            ]}
            pathOptions={{ color: trailColor, opacity: SEGMENT_OPACITIES[index] }}
          />
        );
      })}
      {recentJobLocations.map((point, index) => (
        <CircleMarker
          key={`stop-${point.lat},${point.lng},${index}`}
          center={[point.lat, point.lng]}
          radius={STOP_RADIUS}
          pathOptions={{
            color: STOP_STROKE_COLOR,
            weight: 1.5,
            fillColor: trailColor,
            fillOpacity: SEGMENT_OPACITIES[index],
            opacity: SEGMENT_OPACITIES[index],
          }}
        />
      ))}
    </>
  );
}
