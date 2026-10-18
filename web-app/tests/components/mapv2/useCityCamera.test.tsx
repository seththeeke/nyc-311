import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, render } from "@testing-library/react";
import type { ReactElement } from "react";
import { type CameraActions, type CityCameraOptions, useCityCamera } from "../../../src/components/mapv2/useCityCamera";
import type { CityMapRuntime } from "../../../src/components/mapv2/useCityMap";
import { OVERVIEW } from "../../../src/components/mapv2/useCityMap";
import { FakeMap } from "./fakeMapLibre";

vi.mock("maplibre-gl", async () => ({ Map: (await import("./fakeMapLibre")).FakeMap, setWorkerUrl: () => undefined }));

const ANCHOR = { operatorId: "OP-W", location: { lat: 40.6, lng: -73.9 } };

function fakeRuntime() {
  const map = new FakeMap({});
  const fleet = { setSelected: vi.fn(), anchors: vi.fn(() => [ANCHOR]) };
  const layer = { setPaused: vi.fn() };
  return { map, fleet, layer, runtime: { map, fleet, layer } as unknown as CityMapRuntime };
}

let actions: CameraActions | null = null;

function Probe({ runtime, ...options }: CityCameraOptions & { runtime: CityMapRuntime | null }): ReactElement {
  actions = useCityCamera(runtime, options);
  return <div />;
}

const base: CityCameraOptions = { selectedId: null, divingId: null, paused: false, reducedMotion: false, onDiveArrived: () => undefined };

beforeEach(() => {
  actions = null;
});

describe("useCityCamera — selection", () => {
  it("flies to a selected truck, never closer-out than the focus zoom", () => {
    const { map, fleet, runtime } = fakeRuntime();
    render(<Probe runtime={runtime} {...base} selectedId="OP-W" />);
    expect(fleet.setSelected).toHaveBeenCalledWith("OP-W");
    expect(map.flyTo).toHaveBeenCalledWith(expect.objectContaining({ center: [-73.9, 40.6], zoom: 15.4, pitch: 62, duration: 1800, essential: true }));
  });

  it("cuts instead of flying under reduced motion, and ignores unknown or absent selections", () => {
    const { map, runtime } = fakeRuntime();
    const { rerender } = render(<Probe runtime={runtime} {...base} selectedId="OP-W" reducedMotion />);
    expect(map.jumpTo).toHaveBeenCalledWith(expect.objectContaining({ center: [-73.9, 40.6] }));
    map.jumpTo.mockClear();
    rerender(<Probe runtime={runtime} {...base} selectedId="nobody" reducedMotion />);
    expect(map.jumpTo).not.toHaveBeenCalled();
  });
});

describe("useCityCamera — dive", () => {
  it("plunges toward the truck and reports arrival when the move ends", () => {
    const { map, runtime } = fakeRuntime();
    const onDiveArrived = vi.fn();
    render(<Probe runtime={runtime} {...base} selectedId="OP-W" divingId="OP-W" onDiveArrived={onDiveArrived} />);
    expect(map.flyTo).toHaveBeenLastCalledWith(expect.objectContaining({ zoom: 18.4, pitch: 76, bearing: 35, duration: 2000 }));
    expect(onDiveArrived).not.toHaveBeenCalled();
    act(() => map.fire("moveend"));
    expect(onDiveArrived).toHaveBeenCalledOnce();
  });

  it("arrives at once under reduced motion", () => {
    const { runtime } = fakeRuntime();
    const onDiveArrived = vi.fn();
    render(<Probe runtime={runtime} {...base} divingId="OP-W" reducedMotion onDiveArrived={onDiveArrived} />);
    expect(onDiveArrived).toHaveBeenCalledOnce();
  });
});

describe("useCityCamera — pause and return", () => {
  it("pauses the layer during a dive and pulls back out onto the selection afterwards", () => {
    const { map, layer, runtime } = fakeRuntime();
    const { rerender } = render(<Probe runtime={runtime} {...base} selectedId="OP-W" paused />);
    expect(layer.setPaused).toHaveBeenLastCalledWith(true);
    map.flyTo.mockClear();
    rerender(<Probe runtime={runtime} {...base} selectedId="OP-W" paused={false} />);
    expect(layer.setPaused).toHaveBeenLastCalledWith(false);
    expect(map.flyTo).toHaveBeenLastCalledWith(expect.objectContaining({ center: [-73.9, 40.6], zoom: 15.4, pitch: 60, duration: 1500 }));
  });

  it("pulls back without a center when nothing is selected", () => {
    const { map, runtime } = fakeRuntime();
    const { rerender } = render(<Probe runtime={runtime} {...base} paused />);
    rerender(<Probe runtime={runtime} {...base} paused={false} />);
    expect(map.flyTo).toHaveBeenLastCalledWith(expect.objectContaining({ center: undefined, zoom: 15.4 }));
  });
});

describe("useCityCamera — controls", () => {
  it("zooms, rotates, tilts and resets the camera", () => {
    const { map, runtime } = fakeRuntime();
    render(<Probe runtime={runtime} {...base} />);
    actions!.zoomIn();
    actions!.zoomOut();
    expect(map.zoomIn).toHaveBeenCalledWith({ duration: 400 });
    expect(map.zoomOut).toHaveBeenCalledWith({ duration: 400 });
    map.bearing = 10;
    actions!.rotate(45);
    expect(map.flyTo).toHaveBeenLastCalledWith(expect.objectContaining({ bearing: 55, duration: 700 }));
    actions!.toggleTilt();
    expect(map.flyTo).toHaveBeenLastCalledWith(expect.objectContaining({ pitch: 0 }));
    map.pitch = 0;
    actions!.toggleTilt();
    expect(map.flyTo).toHaveBeenLastCalledWith(expect.objectContaining({ pitch: OVERVIEW.pitch }));
    actions!.resetView();
    expect(map.flyTo).toHaveBeenLastCalledWith(expect.objectContaining({ zoom: 11.05, pitch: OVERVIEW.pitch, duration: 2200 }));
  });

  it("snaps zoom under reduced motion, and every control is a no-op before the map exists", () => {
    const { map, runtime } = fakeRuntime();
    const { rerender } = render(<Probe runtime={runtime} {...base} reducedMotion />);
    actions!.zoomIn();
    actions!.zoomOut();
    expect(map.zoomIn).toHaveBeenCalledWith({ duration: 0 });
    expect(map.zoomOut).toHaveBeenCalledWith({ duration: 0 });
    rerender(<Probe runtime={null} {...base} selectedId="OP-W" divingId="OP-W" />);
    expect(() => {
      actions!.zoomIn();
      actions!.zoomOut();
      actions!.rotate(10);
      actions!.toggleTilt();
      actions!.resetView();
    }).not.toThrow();
  });
});
