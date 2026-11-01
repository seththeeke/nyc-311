import { fireEvent, render } from "@testing-library/react";
import { useRef } from "react";
import { Scene } from "three";
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
/* The real studio needs a GPU for its environment map; the cameras are pure and stay real. */
vi.mock("../../../src/components/team/models/teamStudio", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../src/components/team/models/teamStudio")>();
  return { ...actual, teamStudio: () => new Scene(), applyFilmicTone: () => () => undefined };
});

import type { TeamRig } from "../../../src/components/team/models/kit/teamBody";
import { TEAM_MODELS } from "../../../src/components/team/models/teamModels";
import { useTeamStage } from "../../../src/components/team/useTeamStage";

function Stage({ modelKey, reduced }: { modelKey: string; reduced: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useTeamStage(ref, modelKey, reduced);
  return <canvas ref={ref} data-testid="stage" />;
}

beforeEach(() => {
  gl.renders = 0;
  gl.disposed = 0;
});
afterEach(() => vi.restoreAllMocks());

describe("useTeamStage", () => {
  it("draws one still frame with reduced motion, redraws while dragged, and disposes on unmount", () => {
    const { unmount, getByTestId } = render(<Stage modelKey="penny-platen" reduced />);
    expect(gl.renders).toBe(1);
    fireEvent.pointerMove(window, { clientX: 40 });
    expect(gl.renders).toBe(1);
    fireEvent.pointerDown(getByTestId("stage"), { clientX: 10 });
    fireEvent.pointerMove(window, { clientX: 40 });
    expect(gl.renders).toBe(2);
    fireEvent.pointerUp(window);
    fireEvent.pointerMove(window, { clientX: 80 });
    expect(gl.renders).toBe(2);
    unmount();
    expect(gl.disposed).toBe(1);
  });

  it("animates frame by frame, running the figure's own motion, and stops when unmounted", () => {
    const frames: FrameRequestCallback[] = [];
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => frames.push(callback));
    const cancel = vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => undefined);
    const { unmount } = render(<Stage modelKey="celestine-vey" reduced={false} />);
    frames.shift()?.(0);
    expect(gl.renders).toBe(2);
    unmount();
    expect(cancel).toHaveBeenCalled();
  });

  it("sizes to the canvas when it has a layout, at the device's pixel ratio", () => {
    vi.spyOn(HTMLCanvasElement.prototype, "clientWidth", "get").mockReturnValue(300);
    vi.spyOn(HTMLCanvasElement.prototype, "clientHeight", "get").mockReturnValue(400);
    vi.spyOn(window, "devicePixelRatio", "get").mockReturnValue(0);
    render(<Stage modelKey="kid-kestrel" reduced />);
    expect(gl.renders).toBe(1);
  });

  it("holds the opening frame for a figure with no key moment", () => {
    const models = TEAM_MODELS as Record<string, () => TeamRig>;
    models.plain = () => Object.assign(TEAM_MODELS["kid-kestrel"](), { still: undefined });
    render(<Stage modelKey="plain" reduced />);
    delete models.plain;
    expect(gl.renders).toBe(1);
  });

  it("does nothing for a key with no team model", () => {
    render(<Stage modelKey="hawthorn" reduced />);
    expect(gl.renders).toBe(0);
  });
});
