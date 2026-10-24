import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CustomRenderMethodInput, Map as MapLibreMap } from "maplibre-gl";

const renderer = { autoClear: true, resetState: vi.fn(), render: vi.fn() };
vi.mock("three", async (importOriginal) => ({
  ...(await importOriginal<typeof import("three")>()),
  /* Vitest 5's spy actually `new`s the stored implementation — an arrow fn can never be a constructor. */
  WebGLRenderer: vi.fn(function WebGLRenderer() {
    return renderer;
  }),
}));

const { createFleetLayer, FLEET_LAYER_ID } = await import("../../../../src/components/mapv2/three/fleetLayer");
const { createSceneOrigin, NYC_CENTER } = await import("../../../../src/components/mapv2/geo");
const { FleetScene } = await import("../../../../src/components/mapv2/three/fleetScene");

function fakeMap() {
  return { getCanvas: vi.fn(() => document.createElement("canvas")), getZoom: vi.fn(() => 14), triggerRepaint: vi.fn() };
}

const args = { defaultProjectionData: { mainMatrix: Array.from({ length: 16 }, (_, i) => (i % 5 === 0 ? 1 : 0)) } } as unknown as CustomRenderMethodInput;
const gl = {} as WebGL2RenderingContext;

describe("createFleetLayer", () => {
  beforeEach(() => vi.clearAllMocks());

  it("is a 3-D custom layer that draws nothing before it's added", () => {
    const fleet = new FleetScene(createSceneOrigin(NYC_CENTER));
    const layer = createFleetLayer(fleet, createSceneOrigin(NYC_CENTER), () => 0);
    expect(layer).toMatchObject({ id: FLEET_LAYER_ID, type: "custom", renderingMode: "3d" });
    layer.render(gl, args);
    expect(renderer.render).not.toHaveBeenCalled();
  });

  it("renders the fleet with MapLibre's camera and keeps repainting until paused", () => {
    const origin = createSceneOrigin(NYC_CENTER);
    const fleet = new FleetScene(origin);
    const update = vi.spyOn(fleet, "update");
    const layer = createFleetLayer(fleet, origin, () => 1234);
    const map = fakeMap();
    layer.onAdd?.(map as unknown as MapLibreMap, gl);
    expect(renderer.autoClear).toBe(false);
    layer.render(gl, args);
    expect(update).toHaveBeenCalledWith(1234, 14);
    expect(renderer.resetState).toHaveBeenCalled();
    expect(renderer.render).toHaveBeenCalledWith(fleet.scene, expect.anything());
    expect(map.triggerRepaint).toHaveBeenCalledTimes(1);

    layer.setPaused(true);
    layer.render(gl, args);
    expect(map.triggerRepaint).toHaveBeenCalledTimes(1);
    layer.setPaused(false);
    expect(map.triggerRepaint).toHaveBeenCalledTimes(2);

    layer.onRemove?.(map as unknown as MapLibreMap, gl);
    layer.render(gl, args);
    expect(renderer.render).toHaveBeenCalledTimes(2);
    layer.setPaused(false);
  });
});
