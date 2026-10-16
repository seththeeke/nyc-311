import { type ReactElement, useEffect, useRef } from "react";
import type { MapMouseEvent } from "maplibre-gl";
import type { FleetOperatorLocation } from "../../models/fleetLocation";
import type { ThemeName } from "../../models/theme";
import { CameraControls } from "./CameraControls";
import { pickNearest } from "./picking";
import { useCityCamera } from "./useCityCamera";
import { frameClock, useCityMap } from "./useCityMap";

interface CityViewProps {
  operators: FleetOperatorLocation[];
  theme: ThemeName;
  selectedId: string | null;
  onSelect: (operatorId: string | null) => void;
  /** The Operator whose job we're diving into; the camera plunges toward it, then calls `onDiveArrived`. */
  divingId: string | null;
  onDiveArrived: () => void;
  /** True while the dive-in covers the city — stops the continuous repaint. */
  paused: boolean;
  reducedMotion: boolean;
}

/**
 * The live 3-D city: real NYC buildings from vector tiles, the fleet as
 * animated Three.js trucks, ground trails and job-site glows. Click a
 * truck to select it; the camera follows the selection and the dive.
 */
export function CityView(props: CityViewProps): ReactElement {
  const { operators, theme, selectedId, onSelect, divingId, onDiveArrived, paused, reducedMotion } = props;
  const containerRef = useRef<HTMLDivElement>(null);
  const runtime = useCityMap(containerRef, theme, operators, selectedId, reducedMotion);
  const actions = useCityCamera(runtime, { selectedId, divingId, paused, reducedMotion, onDiveArrived });
  const onSelectRef = useRef(onSelect);
  useEffect(() => {
    onSelectRef.current = onSelect;
  });

  useEffect(() => {
    if (!runtime) return undefined;
    const { map, fleet } = runtime;
    const hit = (event: MapMouseEvent): string | null =>
      pickNearest(fleet.anchors(frameClock()), (location) => map.project([location.lng, location.lat]), event.point);
    const onClick = (event: MapMouseEvent): void => onSelectRef.current(hit(event));
    const onHover = (event: MapMouseEvent): void => {
      map.getCanvas().style.cursor = hit(event) ? "pointer" : "";
    };
    map.on("click", onClick);
    map.on("mousemove", onHover);
    return () => {
      map.off("click", onClick);
      map.off("mousemove", onHover);
    };
  }, [runtime]);

  return (
    <div className="absolute inset-0">
      <div ref={containerRef} className="h-full w-full" data-testid="mapv2-city" aria-label="3-D map of the fleet across New York City" role="application" />
      <CameraControls actions={actions} />
    </div>
  );
}
