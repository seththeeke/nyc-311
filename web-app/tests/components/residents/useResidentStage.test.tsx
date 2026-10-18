import { render } from "@testing-library/react";
import { useRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const gl = vi.hoisted(() => ({ renders: 0, disposed: 0 }));

vi.mock("three", async (importOriginal) => {
  const actual = await importOriginal<typeof import("three")>();
  class FakeRenderer {
    setPixelRatio(): void {}
    setSize(): void {}
    setClearColor(): void {}
    render(): void {
      gl.renders += 1;
    }
    dispose(): void {
      gl.disposed += 1;
    }
  }
  return { ...actual, WebGLRenderer: FakeRenderer };
});

import { STAND_SECONDS, WAVE_SECONDS, stagePose, stageTurn, useResidentStage } from "../../../src/components/residents/useResidentStage";

function Stage({ modelKey, reduced }: { modelKey: string | null; reduced: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useResidentStage(ref, modelKey, reduced);
  return <canvas ref={ref} />;
}

beforeEach(() => {
  gl.renders = 0;
  gl.disposed = 0;
});
afterEach(() => vi.restoreAllMocks());

describe("stage timing", () => {
  it("waves, then stands, then waves again, turning gently", () => {
    expect(stagePose(0.1)).toBe("WAVE");
    expect(stagePose(WAVE_SECONDS + 0.1)).toBe("IDLE");
    expect(stagePose(WAVE_SECONDS + STAND_SECONDS + 0.1)).toBe("WAVE");
    expect(stageTurn(0)).toBeCloseTo(0.25);
  });
});

describe("useResidentStage", () => {
  it("draws one still frame with reduced motion and disposes on unmount", () => {
    const { unmount } = render(<Stage modelKey="sycamore" reduced />);
    expect(gl.renders).toBe(1);
    unmount();
    expect(gl.disposed).toBe(1);
  });

  it("animates frame by frame and stops when unmounted", () => {
    const frames: FrameRequestCallback[] = [];
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => frames.push(callback));
    const cancel = vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => undefined);
    const { unmount } = render(<Stage modelKey="hawthorn" reduced={false} />);
    frames.shift()?.(0);
    frames.shift()?.(0);
    expect(gl.renders).toBe(3);
    unmount();
    expect(cancel).toHaveBeenCalled();
  });

  it("does nothing for a resident without a model", () => {
    render(<Stage modelKey="oak" reduced />);
    render(<Stage modelKey={null} reduced />);
    expect(gl.renders).toBe(0);
  });
});
