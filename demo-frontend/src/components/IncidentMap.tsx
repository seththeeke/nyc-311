import { useMemo } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline } from "react-leaflet";
import L from "leaflet";
import { useLocations, useOperators, useOrders, useTracking } from "../lib/queries";
import { agencyColor, PRIORITY_COLORS, STAGE_LABELS, activityLabel } from "../lib/theme";
import type { Location, Order } from "../lib/types";

const NYC_CENTER: [number, number] = [40.72, -73.94];

const TILE_URLS = {
  light: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
  dark: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
};
const TILE_ATTRIBUTION = {
  light: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  dark: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
};

function incidentIcon(color: string) {
  return L.divIcon({
    className: "",
    html: `<div style="
      width:16px;height:16px;border-radius:50% 50% 50% 0;
      background:${color};border:2px solid white;
      box-shadow:0 1px 6px rgba(0,0,0,.5);
      transform:rotate(-45deg);
    "></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 16],
  });
}

function truckIcon(color: string, activity: string) {
  const ring = activity === "transit" ? `box-shadow:0 0 0 3px ${color}44;` : "";
  return L.divIcon({
    className: "",
    html: `<div style="
      width:22px;height:22px;border-radius:6px;
      background:${color};border:2px solid white;
      display:flex;align-items:center;justify-content:center;
      font-size:12px;box-shadow:0 1px 6px rgba(0,0,0,.5);${ring}
    ">🚚</div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });
}

interface IncidentMapProps {
  height?: number | string;
  onSelectOrder?: (order_id: string) => void;
  /** "card" = bordered rounded box at a fixed height (default).
   *  "immersive" = dark basemap, fills its parent completely, no border/radius — meant to sit behind overlaid content. */
  variant?: "card" | "immersive";
}

export function IncidentMap({ height = 480, onSelectOrder, variant = "card" }: IncidentMapProps) {
  const { data: orders } = useOrders();
  const { data: locations } = useLocations();
  const { data: tracking } = useTracking();
  const { data: operators } = useOperators();
  const immersive = variant === "immersive";
  const tileStyle = immersive ? "dark" : "light";

  const operatorById = useMemo(() => {
    const map = new Map<string, NonNullable<typeof operators>[number]>();
    for (const o of operators ?? []) map.set(o.operator_id, o);
    return map;
  }, [operators]);

  const locationById = useMemo(() => {
    const map = new Map<string, Location>();
    for (const l of locations ?? []) map.set(l.location_id, l);
    return map;
  }, [locations]);

  const incidents = useMemo(() => (orders ?? []).filter((o) => o.status === "in_progress" || o.status === "blocked"), [orders]);

  return (
    <div
      style={immersive ? undefined : { height }}
      className={
        immersive
          ? "map-dark absolute inset-0 h-full w-full"
          : "relative w-full overflow-hidden rounded-lg border border-[var(--color-border)]"
      }
    >
      <MapContainer center={NYC_CENTER} zoom={11} scrollWheelZoom zoomControl={!immersive} style={{ height: "100%", width: "100%" }}>
        <TileLayer attribution={TILE_ATTRIBUTION[tileStyle]} url={TILE_URLS[tileStyle]} />

        {incidents.map((order) => {
          const loc = locationById.get(order.location_id);
          if (!loc) return null;
          const color = order.status === "blocked" ? PRIORITY_COLORS.critical : PRIORITY_COLORS[order.priority_tier];
          return (
            <Marker
              key={order.order_id}
              position={[loc.latitude, loc.longitude]}
              icon={incidentIcon(color)}
              eventHandlers={onSelectOrder ? { click: () => onSelectOrder(order.order_id) } : undefined}
            >
              <Popup>
                <IncidentPopup order={order} location={loc} />
              </Popup>
            </Marker>
          );
        })}

        {(tracking ?? []).map((t) => {
          const op = t;
          if (!op.position) return null;
          return (
            <div key={op.operator_id}>
              {op.trail.length > 1 && (
                <Polyline
                  positions={op.trail.map((p) => [p.latitude, p.longitude])}
                  pathOptions={{ color: immersive ? "#8b93a1" : "#8794a3", weight: 2, opacity: 0.5 }}
                />
              )}
              {op.predicted_path.length > 1 && (
                <Polyline
                  positions={op.predicted_path.map((p) => [p.latitude, p.longitude])}
                  pathOptions={{ color: immersive ? "#3987e5" : "#2454c7", weight: 2, dashArray: "4 6", opacity: 0.85 }}
                />
              )}
            </div>
          );
        })}

        {(tracking ?? []).map((t) => {
          const op = operatorById.get(t.operator_id);
          if (!t.position || !op) return null;
          return (
            <Marker
              key={t.operator_id}
              position={[t.position.latitude, t.position.longitude]}
              icon={truckIcon(agencyColor(op.function_type, immersive ? "dark" : "light"), t.current_activity)}
            >
              <Popup>
                <div className="text-sm">
                  <div className="font-semibold">{op._display_name}</div>
                  <div className="text-gray-500">{op.function_type} &middot; {activityLabel(t.current_activity)}</div>
                  {op._assigned_order_id && <div className="mt-1 text-xs text-gray-500">Assigned to {op._assigned_order_id}</div>}
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>

      <MapLegend dark={immersive} />
    </div>
  );
}

function IncidentPopup({ order, location }: { order: Order; location: Location }) {
  return (
    <div className="text-sm">
      <div className="font-semibold">{order._complaint_type}</div>
      <div className="text-gray-500">{location.address}, {location.borough}</div>
      <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-gray-600">
        <span>Stage: {STAGE_LABELS[order.current_stage]}</span>
        <span>Priority: {order.priority_tier}</span>
        <span>Agency: {order._agency}</span>
      </div>
      {order.status === "blocked" && order.case_id && (
        <div className="mt-1 text-xs font-medium text-[var(--color-critical)]">Blocked &mdash; escalated as {order.case_id}</div>
      )}
    </div>
  );
}

function MapLegend({ dark }: { dark: boolean }) {
  return (
    <div
      className={
        dark
          ? "absolute bottom-4 left-4 z-[500] rounded-lg border border-[var(--color-glass-border)] bg-[var(--color-glass-bg)] px-3 py-2 text-xs text-[var(--color-glass-ink-soft)] backdrop-blur-md"
          : "absolute bottom-3 left-3 z-[1000] rounded-md border border-[var(--color-border)] bg-white/95 px-3 py-2 text-xs shadow-sm"
      }
    >
      <div className={`mb-1 font-semibold ${dark ? "text-[var(--color-glass-ink)]" : "text-[var(--color-ink)]"}`}>Legend</div>
      <div className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: PRIORITY_COLORS.critical }} /> Blocked / critical incident</div>
      <div className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: PRIORITY_COLORS.high }} /> High priority</div>
      <div className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: PRIORITY_COLORS.standard }} /> Standard incident</div>
      <div className="mt-1.5 flex items-center gap-1.5">🚚 <span>Operator (color = agency)</span></div>
      <div className="flex items-center gap-1.5"><span className="inline-block h-0.5 w-4" style={{ background: dark ? "#3987e5" : "#2454c7", borderTop: `2px dashed ${dark ? "#3987e5" : "#2454c7"}` }} /> Predicted path</div>
    </div>
  );
}
