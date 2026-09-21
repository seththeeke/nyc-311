import type { ReactElement } from "react";
import { useFleetLocations } from "../../hooks/useFleetLocations";
import { MetricTileBody } from "./MetricTileBody";

/** Total active Operator count — the one LIVE tile; formerly the map's overlay (`CapacityTile`). */
export function CapacityWidget(): ReactElement {
  const { locations } = useFleetLocations();
  const count = locations ? locations.operators.length : null;

  return (
    <div role="status" aria-label={count === null ? "Total capacity: loading" : `Total capacity: ${count} operators`}>
      <MetricTileBody value={count === null ? "—" : String(count)} detail="active operators" />
    </div>
  );
}
