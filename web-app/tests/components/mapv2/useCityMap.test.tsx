import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, render } from "@testing-library/react";
import { useRef, type ReactElement } from "react";
import type { FleetOperatorLocation } from "../../../src/models/fleetLocation";
import type { ThemeName } from "../../../src/models/theme";
import { FakeMap } from "./fakeMapLibre";
import { IDLE_OPERATOR, WORKING_OPERATOR } from "./fixtures";

/* A plain array, not a vi.fn — the call happens at import time, before beforeEach clears mocks. */
const workerUrls: string[] = [];
vi.mock("maplibre-gl", () => ({ Map: FakeMap, setWorkerUrl: (url: string) => workerUrls.push(url) }));
const syncOverlays = vi.fn();
vi.mock("../../../src/components/mapv2/fleetOverlays", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../src/components/mapv2/fleetOverlays")>()),
  syncOverlays: (...args: unknown[]) => syncOverlays(...args),
}));
const { useCityMap, OVERVIEW, NYC_BOUNDS, frameClock } = await import("../../../src/components/mapv2/useCityMap");
import type { CityMapRuntime } from "../../../src/components/mapv2/useCityMap";

let runtime: CityMapRuntime | null = null;

interface ProbeProps {
  theme?: ThemeName;
  operators?: FleetOperatorLocation[];
  selectedId?: string | null;
  reducedMotion?: boolean;
}

function Probe({ theme = "DARK", operators = [IDLE_OPERATOR], selectedId = null, reducedMotion = false }: ProbeProps): ReactElement {
  const ref = useRef<HTMLDivElement>(null);
  runtime = useCityMap(ref, theme, operators, selectedId, reducedMotion);
  return <div ref={ref} />;
}

function NoContainer(): ReactElement {
  const ref = useRef<HTMLDivElement>(null);
  runtime = useCityMap(ref, "DARK", [], null, false);
  return <span />;
}

function lastMap(): FakeMap {
  return FakeMap.instances[FakeMap.instances.length - 1];
}

beforeEach(() => {
  FakeMap.instances = [];
  runtime = null;
  vi.clearAllMocks();
});

describe("useCityMap", () => {
  it("points MapLibre at its bundled worker and exposes a frame clock", () => {
    expect(workerUrls).toEqual([expect.stringContaining("maplibre-gl-worker")]);
    expect(typeof frameClock()).toBe("number");
  });

  it("opens on the establishing shot and swings into the overview once loaded", () => {
    render(<Probe />);
    const map = lastMap();
    expect(map.options).toMatchObject({ zoom: 9.6, pitch: 0, maxPitch: 80 });
    expect(runtime).toBeNull();
    act(() => map.fire("load"));
    expect(map.cameraForBounds).toHaveBeenCalledWith(NYC_BOUNDS, expect.objectContaining({ bearing: OVERVIEW.bearing }));
    expect(map.easeTo).toHaveBeenCalledWith(expect.objectContaining({ center: [-73.97, 40.7], zoom: 11.05, pitch: OVERVIEW.pitch, duration: 4200 }));
    expect(runtime?.map).toBe(map);
    expect(runtime?.fleet.size).toBe(1);
  });

  it("starts on the overview with no intro under reduced motion", () => {
    render(<Probe reducedMotion />);
    const map = lastMap();
    expect(map.options).toMatchObject({ zoom: OVERVIEW.zoom, pitch: OVERVIEW.pitch });
    act(() => map.fire("load"));
    expect(map.easeTo).not.toHaveBeenCalled();
    expect(map.jumpTo).toHaveBeenCalledWith(expect.objectContaining({ zoom: 11.05, pitch: OVERVIEW.pitch }));
  });

  it("redraws once a lost WebGL context is restored", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    render(<Probe />);
    const map = lastMap();
    map.fire("webglcontextlost");
    expect(map.triggerRepaint).not.toHaveBeenCalled();
    map.fire("webglcontextrestored");
    expect(map.triggerRepaint).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledTimes(2);
    warn.mockRestore();
  });

  it("falls back to the fixed overview when the bounds can't be fitted", () => {
    render(<Probe reducedMotion />);
    const map = lastMap();
    map.cameraForBounds.mockReturnValue(undefined);
    act(() => map.fire("load"));
    expect(map.jumpTo).toHaveBeenCalledWith(OVERVIEW);
  });

  it("adds the fleet layer and overlays on every style load, once each", () => {
    render(<Probe />);
    const map = lastMap();
    act(() => map.fire("style.load"));
    act(() => map.fire("style.load"));
    expect(map.addLayer).toHaveBeenCalledTimes(1);
    expect(syncOverlays).toHaveBeenCalledTimes(2);
    expect(syncOverlays).toHaveBeenLastCalledWith(map, expect.anything(), "building-3d");
  });

  it("reloads the style on a theme change, but not for the theme it started with", () => {
    const { rerender } = render(<Probe theme="DARK" />);
    const map = lastMap();
    act(() => map.fire("load"));
    rerender(<Probe theme="DARK" />);
    expect(map.setStyle).not.toHaveBeenCalled();
    rerender(<Probe theme="LIGHT" />);
    expect(map.setStyle).toHaveBeenCalledWith(expect.objectContaining({ version: 8 }), { diff: false });
  });

  it("feeds polls and selection into the fleet and overlays, waiting for the style when it's reloading", () => {
    const { rerender } = render(<Probe operators={[IDLE_OPERATOR]} />);
    const map = lastMap();
    act(() => map.fire("load"));
    syncOverlays.mockClear();
    rerender(<Probe operators={[IDLE_OPERATOR, WORKING_OPERATOR]} selectedId="OP-W" />);
    expect(runtime?.fleet.size).toBe(2);
    const [, data] = syncOverlays.mock.calls[syncOverlays.mock.calls.length - 1] as [unknown, { trails: { features: unknown[] } }];
    expect(data.trails.features).toHaveLength(1);
    map.styleLoaded = false;
    syncOverlays.mockClear();
    rerender(<Probe operators={[WORKING_OPERATOR]} selectedId={null} />);
    expect(syncOverlays).not.toHaveBeenCalled();
  });

  it("tears the map down on unmount, and does nothing without a container", () => {
    const { unmount } = render(<Probe />);
    const map = lastMap();
    unmount();
    expect(map.remove).toHaveBeenCalled();
    FakeMap.instances = [];
    render(<NoContainer />);
    expect(FakeMap.instances).toHaveLength(0);
  });
});
