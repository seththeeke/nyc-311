import { useCallback, useEffect, useRef } from "react";
import type { JumpToOptions } from "maplibre-gl";
import { type CityMapRuntime, frameClock, OVERVIEW, overviewCamera } from "./useCityMap";

/*
 * The city camera's choreography: glide to a truck when it's selected,
 * plunge toward it when diving into its job, pull back out on return.
 * Under reduced motion every move is an instant cut.
 */

const FOCUS_ZOOM = 15.4;
const DIVE = { zoom: 18.4, pitch: 76, bearingSwing: 35, duration: 2000 };

export interface CityCameraOptions {
  selectedId: string | null;
  divingId: string | null;
  paused: boolean;
  reducedMotion: boolean;
  onDiveArrived: () => void;
}

export interface CameraActions {
  zoomIn(): void;
  zoomOut(): void;
  rotate(degrees: number): void;
  toggleTilt(): void;
  resetView(): void;
}

export function useCityCamera(runtime: CityMapRuntime | null, options: CityCameraOptions): CameraActions {
  const { selectedId, divingId, paused, reducedMotion } = options;
  const onArrived = useRef(options.onDiveArrived);
  useEffect(() => {
    onArrived.current = options.onDiveArrived;
  });
  const wasPaused = useRef(paused);

  const move = useCallback(
    (target: JumpToOptions, duration: number) => {
      if (!runtime) return;
      if (reducedMotion) runtime.map.jumpTo(target);
      else runtime.map.flyTo({ ...target, duration, essential: true });
    },
    [runtime, reducedMotion]
  );

  const anchorOf = useCallback(
    (operatorId: string | null) => runtime?.fleet.anchors(frameClock()).find((a) => a.operatorId === operatorId) ?? null,
    [runtime]
  );

  useEffect(() => {
    runtime?.fleet.setSelected(selectedId);
    const anchor = anchorOf(selectedId);
    if (!runtime || !anchor || divingId || paused) return;
    move({ center: [anchor.location.lng, anchor.location.lat], zoom: Math.max(runtime.map.getZoom(), FOCUS_ZOOM), pitch: 62 }, 1800);
  }, [runtime, selectedId, divingId, paused, anchorOf, move]);

  useEffect(() => {
    const anchor = anchorOf(divingId);
    if (!runtime || !anchor) return;
    if (reducedMotion) {
      onArrived.current();
      return;
    }
    runtime.map.once("moveend", () => onArrived.current());
    move({ center: [anchor.location.lng, anchor.location.lat], zoom: DIVE.zoom, pitch: DIVE.pitch, bearing: runtime.map.getBearing() + DIVE.bearingSwing }, DIVE.duration);
  }, [runtime, divingId, reducedMotion, anchorOf, move]);

  /* Declared after the selection effect so, on return from a dive, this pull-back is the move that wins. */
  useEffect(() => {
    if (!runtime) return;
    runtime.layer.setPaused(paused);
    if (wasPaused.current && !paused) {
      const anchor = anchorOf(selectedId);
      const center: [number, number] | undefined = anchor ? [anchor.location.lng, anchor.location.lat] : undefined;
      move({ center, zoom: FOCUS_ZOOM, pitch: 60 }, 1500);
    }
    wasPaused.current = paused;
  }, [runtime, paused, selectedId, anchorOf, move]);

  return {
    zoomIn: () => runtime?.map.zoomIn({ duration: reducedMotion ? 0 : 400 }),
    zoomOut: () => runtime?.map.zoomOut({ duration: reducedMotion ? 0 : 400 }),
    rotate: (degrees) => runtime && move({ bearing: runtime.map.getBearing() + degrees }, 700),
    toggleTilt: () => runtime && move({ pitch: runtime.map.getPitch() > 10 ? 0 : OVERVIEW.pitch }, 800),
    resetView: () => runtime && move(overviewCamera(runtime.map), 2200),
  };
}
