import { afterEach, describe, expect, it, vi } from "vitest";
import { act, render } from "@testing-library/react";
import { useRef, type ReactElement } from "react";
import { useCityPulse } from "../../../src/components/marketing/useCityPulse";
import { fakeContext2d } from "./fakeCanvas";

function Hero({ reduced }: { reduced: boolean }): ReactElement {
  const ref = useRef<HTMLCanvasElement>(null);
  useCityPulse(ref, reduced, "DARK");
  return <canvas ref={ref} data-testid="canvas" />;
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("useCityPulse", () => {
  it("does nothing where a 2-D context is unavailable", () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
    const raf = vi.spyOn(window, "requestAnimationFrame");
    render(<Hero reduced={false} />);
    expect(raf).not.toHaveBeenCalled();
  });

  it("sizes the canvas, animates frames, follows the pointer and cleans up", () => {
    vi.useFakeTimers({ toFake: ["requestAnimationFrame", "cancelAnimationFrame"] });
    const ctx = fakeContext2d();
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(ctx);
    vi.spyOn(HTMLCanvasElement.prototype, "getBoundingClientRect").mockReturnValue({ left: 10, top: 20, width: 600, height: 400 } as DOMRect);
    const { getByTestId, unmount } = render(<Hero reduced={false} />);
    const canvas = getByTestId("canvas") as HTMLCanvasElement;
    expect(canvas.width).toBe(600 * (window.devicePixelRatio || 1));
    act(() => {
      window.dispatchEvent(new PointerEvent("pointermove", { clientX: 110, clientY: 120 }));
      vi.advanceTimersByTime(100);
    });
    expect(ctx.createRadialGradient).toHaveBeenCalledWith(100, 100, 0, 100, 100, 140);
    act(() => {
      document.dispatchEvent(new Event("pointerleave"));
      window.dispatchEvent(new Event("resize"));
      vi.advanceTimersByTime(50);
    });
    const remove = vi.spyOn(window, "removeEventListener");
    unmount();
    expect(remove).toHaveBeenCalledWith("pointermove", expect.any(Function));
  });

  it("draws one warmed-up still frame under reduced motion, with no animation loop", () => {
    const ctx = fakeContext2d();
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(ctx);
    const raf = vi.spyOn(window, "requestAnimationFrame");
    render(<Hero reduced={true} />);
    expect(raf).not.toHaveBeenCalled();
    expect(ctx.clearRect).toHaveBeenCalledTimes(1);
  });
});
