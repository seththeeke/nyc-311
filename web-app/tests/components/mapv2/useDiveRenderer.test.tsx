import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render } from "@testing-library/react";
import { useRef, type ReactElement } from "react";

const renderer = { setPixelRatio: vi.fn(), setSize: vi.fn(), render: vi.fn(), dispose: vi.fn(), toneMapping: 0 };
vi.mock("three", async (importOriginal) => ({
  ...(await importOriginal<typeof import("three")>()),
  WebGLRenderer: vi.fn(() => renderer),
}));
const { useDiveRenderer } = await import("../../../src/components/mapv2/useDiveRenderer");
import type { TimelineState } from "../../../src/components/mapv2/repairTimeline";

let frames: FrameRequestCallback[] = [];
let resize: (() => void) | null = null;
const disconnect = vi.fn();
let now = 0;
let seen: TimelineState | null = null;

function Probe({ reducedMotion, withCanvas = true }: { reducedMotion: boolean; withCanvas?: boolean }): ReactElement {
  const ref = useRef<HTMLCanvasElement>(null);
  seen = useDiveRenderer(ref, "STREET_REPAIR", "DARK", reducedMotion);
  return withCanvas ? <canvas ref={ref} /> : <div />;
}

function size(width: number, height: number): void {
  Object.defineProperty(HTMLCanvasElement.prototype, "clientWidth", { configurable: true, get: () => width });
  Object.defineProperty(HTMLCanvasElement.prototype, "clientHeight", { configurable: true, get: () => height });
}

beforeEach(() => {
  frames = [];
  now = 0;
  vi.clearAllMocks();
  vi.spyOn(performance, "now").mockImplementation(() => now);
  vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
    frames.push(cb);
    return frames.length;
  });
  vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => undefined);
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(cb: () => void) {
        resize = cb;
      }
      observe(): void {}
      disconnect = disconnect;
    }
  );
  size(800, 400);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("useDiveRenderer", () => {
  it("sizes the renderer to the canvas, animates every frame and advances the HUD", () => {
    const { unmount } = render(<Probe reducedMotion={false} />);
    expect(renderer.setSize).toHaveBeenCalledWith(800, 400, false);
    expect(renderer.render).toHaveBeenCalledTimes(1);
    expect(seen?.phase).toBe("ARRIVE");
    now = 8_500;
    act(() => frames[frames.length - 1](now));
    expect(seen?.phase).toBe("CUT");
    const renders = renderer.render.mock.calls.length;
    act(() => frames[frames.length - 1](now));
    expect(renderer.render.mock.calls.length).toBe(renders + 1);
    unmount();
    expect(disconnect).toHaveBeenCalled();
    expect(renderer.dispose).toHaveBeenCalled();
  });

  it("draws one frozen frame under reduced motion, redrawing only on resize", () => {
    render(<Probe reducedMotion />);
    expect(frames).toHaveLength(0);
    expect(seen?.phase).toBe("FILL");
    const draws = renderer.render.mock.calls.length;
    act(() => resize?.());
    expect(renderer.render.mock.calls.length).toBe(draws + 1);
  });

  it("skips sizing a collapsed canvas and does nothing without one", () => {
    size(0, 0);
    render(<Probe reducedMotion={false} />);
    expect(renderer.setSize).not.toHaveBeenCalled();
    vi.clearAllMocks();
    render(<Probe reducedMotion={false} withCanvas={false} />);
    expect(renderer.render).not.toHaveBeenCalled();
  });
});
