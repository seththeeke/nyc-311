import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const webGl = vi.hoisted(() => ({ available: true }));
const snapshot = vi.hoisted(() => ({ render: vi.fn() }));

vi.mock("../../src/components/three/webgl", () => ({ isWebGlAvailable: () => webGl.available }));
vi.mock("../../src/components/residents/models/avatarSnapshot", () => ({ renderResidentAvatar: snapshot.render }));

import { clearResidentAvatars, useResidentAvatar } from "../../src/hooks/useResidentAvatar";

beforeEach(() => {
  clearResidentAvatars();
  webGl.available = true;
  snapshot.render.mockReset();
});

describe("useResidentAvatar", () => {
  it("draws a resident once, then reuses the snapshot", async () => {
    snapshot.render.mockReturnValue("data:image/png;base64,HAW");
    const first = renderHook(() => useResidentAvatar("hawthorn"));
    await waitFor(() => expect(first.result.current).toBe("data:image/png;base64,HAW"));
    const second = renderHook(() => useResidentAvatar("hawthorn"));
    expect(second.result.current).toBe("data:image/png;base64,HAW");
    expect(snapshot.render).toHaveBeenCalledTimes(1);
  });

  it("gives null with no model, no WebGL, or a failed draw", async () => {
    expect(renderHook(() => useResidentAvatar(null)).result.current).toBeNull();
    webGl.available = false;
    expect(renderHook(() => useResidentAvatar("juniper")).result.current).toBeNull();
    webGl.available = true;
    snapshot.render.mockImplementation(() => {
      throw new Error("context lost");
    });
    const failed = renderHook(() => useResidentAvatar("sycamore"));
    await waitFor(() => expect(snapshot.render).toHaveBeenCalled());
    expect(failed.result.current).toBeNull();
  });

  it("clears back to null when the key goes away, and ignores a draw that lands after unmount", async () => {
    snapshot.render.mockReturnValue("data:image/png;base64,J");
    const hook = renderHook(({ key }) => useResidentAvatar(key), { initialProps: { key: "juniper" as string | null } });
    await waitFor(() => expect(hook.result.current).toBe("data:image/png;base64,J"));
    hook.rerender({ key: null });
    expect(hook.result.current).toBeNull();
    clearResidentAvatars();
    const gone = renderHook(() => useResidentAvatar("juniper"));
    gone.unmount();
    await waitFor(() => expect(snapshot.render).toHaveBeenCalledTimes(2));
  });
});
