import { afterEach, describe, expect, it, vi } from "vitest";
import { isWebGlAvailable } from "../../../src/components/three/webgl";

describe("isWebGlAvailable", () => {
  afterEach(() => vi.restoreAllMocks());

  it("is true when a WebGL2 context can be created", () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({} as RenderingContext);
    expect(isWebGlAvailable()).toBe(true);
  });

  it("releases the probe context so checks never use up the browser's context limit", () => {
    const loseContext = vi.fn();
    const getExtension = vi.fn(() => ({ loseContext }));
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({ getExtension } as unknown as RenderingContext);
    expect(isWebGlAvailable()).toBe(true);
    expect(getExtension).toHaveBeenCalledWith("WEBGL_lose_context");
    expect(loseContext).toHaveBeenCalled();
  });

  it("is still true when the release extension is missing", () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({ getExtension: () => null } as unknown as RenderingContext);
    expect(isWebGlAvailable()).toBe(true);
  });

  it("is false when the browser returns no context", () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
    expect(isWebGlAvailable()).toBe(false);
  });

  it("is false when asking throws", () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(isWebGlAvailable()).toBe(false);
  });
});
