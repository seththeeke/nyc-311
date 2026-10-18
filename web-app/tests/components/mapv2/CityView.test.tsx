import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { FakeMap } from "./fakeMapLibre";
import { WORKING_OPERATOR } from "./fixtures";

vi.mock("maplibre-gl", async () => ({ Map: (await import("./fakeMapLibre")).FakeMap, setWorkerUrl: () => undefined }));

const map = new FakeMap({});
const fleet = { anchors: vi.fn(() => [{ operatorId: "OP-W", location: { lat: 10, lng: 10 } }]) };
let runtime: unknown = null;
const useCityMap = vi.fn(() => runtime);
const useCityCamera = vi.fn(() => ({ zoomIn: vi.fn(), zoomOut: vi.fn(), rotate: vi.fn(), toggleTilt: vi.fn(), resetView: vi.fn() }));
vi.mock("../../../src/components/mapv2/useCityMap", () => ({ useCityMap: (...a: unknown[]) => useCityMap(...(a as [])), frameClock: () => 0 }));
vi.mock("../../../src/components/mapv2/useCityCamera", () => ({ useCityCamera: (...a: unknown[]) => useCityCamera(...(a as [])) }));
const { CityView } = await import("../../../src/components/mapv2/CityView");

const props = {
  operators: [WORKING_OPERATOR],
  theme: "DARK" as const,
  selectedId: null,
  divingId: null,
  onDiveArrived: vi.fn(),
  paused: false,
  reducedMotion: false,
};

beforeEach(() => {
  runtime = null;
  vi.clearAllMocks();
});

describe("CityView", () => {
  it("renders the map host and camera controls, passing its state to the map hooks", () => {
    render(<CityView {...props} onSelect={vi.fn()} />);
    expect(screen.getByRole("application", { name: /3-D map of the fleet/ })).toBeInTheDocument();
    expect(screen.getByRole("toolbar", { name: "Camera" })).toBeInTheDocument();
    expect(screen.getByTestId("mapv2-city")).toHaveAttribute("data-state", "loading");
    expect(useCityMap).toHaveBeenCalledWith(expect.anything(), "DARK", props.operators, null, false);
    expect(useCityCamera).toHaveBeenCalledWith(null, expect.objectContaining({ paused: false, divingId: null }));
  });

  it("selects the truck under a click, clears on a miss, and shows a pointer over trucks", () => {
    runtime = { map, fleet };
    const onSelect = vi.fn();
    const { unmount } = render(<CityView {...props} onSelect={onSelect} />);
    expect(screen.getByTestId("mapv2-city")).toHaveAttribute("data-state", "ready");
    act(() => map.fire("click", { point: { x: 12, y: 9 } }));
    act(() => map.fire("click", { point: { x: 500, y: 500 } }));
    expect(onSelect.mock.calls).toEqual([["OP-W"], [null]]);
    act(() => map.fire("mousemove", { point: { x: 10, y: 10 } }));
    expect(map.canvas.style.cursor).toBe("pointer");
    act(() => map.fire("mousemove", { point: { x: 400, y: 400 } }));
    expect(map.canvas.style.cursor).toBe("");
    unmount();
    expect(map.off).toHaveBeenCalledWith("click", expect.any(Function));
    expect(map.off).toHaveBeenCalledWith("mousemove", expect.any(Function));
  });
});
