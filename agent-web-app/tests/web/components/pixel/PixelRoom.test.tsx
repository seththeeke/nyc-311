import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { PixelRoom } from "../../../../web/components/pixel/PixelRoom.tsx";
import type { RoomDraw } from "../../../../web/components/pixel/pixelKit.ts";

function fakeContext() {
  return { fillStyle: "", fillRect: vi.fn(), clearRect: vi.fn() };
}

afterEach(() => vi.useRealTimers());

describe("PixelRoom", () => {
  it("draws a frame on mount, animates, and stops when unmounted", () => {
    vi.useFakeTimers();
    const ctx = fakeContext();
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(ctx as never);
    vi.stubGlobal("matchMedia", () => ({ matches: false }));
    const draw = vi.fn<RoomDraw>((p) => p.rect(0, 0, 1, 1, "#fff"));
    const { unmount } = render(<PixelRoom draw={draw} state="WORKING" label="Workshop" />);
    expect(screen.getByRole("img", { name: "Workshop" })).toBeInTheDocument();
    expect(draw).toHaveBeenCalledTimes(1);
    expect(draw.mock.calls[0][1]).toMatchObject({ t: 0, state: "WORKING" });
    vi.advanceTimersByTime(250);
    expect(draw).toHaveBeenCalledTimes(3);
    expect(ctx.fillRect).toHaveBeenCalled();
    unmount();
    vi.advanceTimersByTime(500);
    expect(draw).toHaveBeenCalledTimes(3);
  });

  it("holds one frame under reduced motion", () => {
    vi.useFakeTimers();
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(fakeContext() as never);
    vi.stubGlobal("matchMedia", () => ({ matches: true }));
    const draw = vi.fn<RoomDraw>();
    render(<PixelRoom draw={draw} state="IDLE" label="Room" />);
    vi.advanceTimersByTime(1000);
    expect(draw).toHaveBeenCalledTimes(1);
  });

  it("animates when matchMedia is missing, and does nothing without a 2D context", () => {
    vi.useFakeTimers();
    vi.stubGlobal("matchMedia", undefined);
    const getContext = vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(fakeContext() as never);
    const draw = vi.fn<RoomDraw>();
    const { unmount } = render(<PixelRoom draw={draw} state="IDLE" label="Room" />);
    vi.advanceTimersByTime(125);
    expect(draw).toHaveBeenCalledTimes(2);
    unmount();
    getContext.mockReturnValue(null);
    const none = vi.fn<RoomDraw>();
    render(<PixelRoom draw={none} state="IDLE" label="Room" />);
    expect(none).not.toHaveBeenCalled();
  });
});
