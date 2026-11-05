import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const webGl = vi.hoisted(() => ({ available: true }));
const snapshot = vi.hoisted(() => ({ render: vi.fn() }));

vi.mock("../../src/components/three/webgl", () => ({ isWebGlAvailable: () => webGl.available }));
const worker = vi.hoisted(() => ({ supported: false, render: vi.fn() }));
vi.mock("../../src/components/residents/models/avatarSnapshot", () => ({ renderResidentAvatar: snapshot.render }));
vi.mock("../../src/components/residents/models/avatarWorkerClient", () => ({
  avatarWorkerSupported: () => worker.supported,
  avatarWorkerClient: { render: worker.render },
}));

import { clearResidentAvatars, useResidentAvatar } from "../../src/hooks/useResidentAvatar";

beforeEach(() => {
  clearResidentAvatars();
  webGl.available = true;
  snapshot.render.mockReset();
  worker.supported = false;
  worker.render.mockReset();
  vi.unstubAllGlobals();
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

  it("draws in the avatar worker where it can, as a blob URL, and shares one render between two avatars", async () => {
    worker.supported = true;
    worker.render.mockResolvedValue({ id: 1, blob: new Blob(["png"]), failed: false });
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:avatar");
    const a = renderHook(() => useResidentAvatar("ginkgo"));
    const b = renderHook(() => useResidentAvatar("ginkgo"));
    await waitFor(() => expect(a.result.current).toBe("blob:avatar"));
    await waitFor(() => expect(b.result.current).toBe("blob:avatar"));
    expect(worker.render).toHaveBeenCalledTimes(1);
    expect(snapshot.render).not.toHaveBeenCalled();
  });

  it("gives null when the worker finds no model", async () => {
    worker.supported = true;
    worker.render.mockResolvedValue({ id: 1, blob: null, failed: false });
    const hook = renderHook(() => useResidentAvatar("oak"));
    await waitFor(() => expect(worker.render).toHaveBeenCalled());
    await waitFor(() => expect(hook.result.current).toBeNull());
    expect(snapshot.render).not.toHaveBeenCalled();
  });

  it("falls back to drawing on the page when the worker fails, waiting for an idle moment", async () => {
    worker.supported = true;
    worker.render.mockResolvedValue({ id: 1, blob: null, failed: true });
    snapshot.render.mockReturnValue("data:image/png;base64,PAGE");
    const idle = vi.fn((callback: () => void) => {
      callback();
      return 1;
    });
    vi.stubGlobal("requestIdleCallback", idle);
    const hook = renderHook(() => useResidentAvatar("dogwood"));
    await waitFor(() => expect(hook.result.current).toBe("data:image/png;base64,PAGE"));
    expect(idle).toHaveBeenCalledWith(expect.any(Function), { timeout: 1500 });
  });
});
