import { afterEach, describe, expect, it, vi } from "vitest";

const draw = vi.hoisted(() => ({ result: true, throws: false, created: 0 }));
vi.mock("../../../../src/components/residents/models/avatarSnapshot", () => ({
  AVATAR_PIXELS: 160,
  createAvatarRenderer: (canvas: OffscreenCanvas) => {
    draw.created += 1;
    return { domElement: canvas };
  },
  drawAvatar: () => {
    if (draw.throws) throw new Error("no WebGL in workers");
    return draw.result;
  },
}));

import { answerAvatarRequest, resetAvatarWorkerRenderer, wireAvatarWorker, type AvatarReply, type AvatarRequest } from "../../../../src/components/residents/models/avatarWorkerCore";
import { AvatarWorkerClient, avatarWorkerSupported } from "../../../../src/components/residents/models/avatarWorkerClient";

const png = new Blob(["png"], { type: "image/png" });
const canvas = (): OffscreenCanvas => ({ convertToBlob: vi.fn(async () => png) }) as unknown as OffscreenCanvas;

afterEach(() => {
  resetAvatarWorkerRenderer();
  draw.result = true;
  draw.throws = false;
  draw.created = 0;
  vi.unstubAllGlobals();
});

describe("answerAvatarRequest", () => {
  it("draws on one offscreen renderer and answers with a PNG blob", async () => {
    expect(await answerAvatarRequest({ id: 1, modelKey: "hawthorn" }, canvas)).toEqual({ id: 1, blob: png, failed: false });
    expect(await answerAvatarRequest({ id: 2, modelKey: "juniper" }, canvas)).toEqual({ id: 2, blob: png, failed: false });
    expect(draw.created).toBe(1);
  });

  it("answers null for a key with no model, and failed when it can't draw at all", async () => {
    draw.result = false;
    expect(await answerAvatarRequest({ id: 3, modelKey: "oak" }, canvas)).toEqual({ id: 3, blob: null, failed: false });
    draw.throws = true;
    expect(await answerAvatarRequest({ id: 4, modelKey: "hawthorn" }, canvas)).toEqual({ id: 4, blob: null, failed: true });
  });

  it("makes its own OffscreenCanvas by default", async () => {
    vi.stubGlobal("OffscreenCanvas", class {
      convertToBlob = async () => png;
    });
    expect((await answerAvatarRequest({ id: 5, modelKey: "hawthorn" })).blob).toBe(png);
  });
});

describe("wireAvatarWorker and the worker entry", () => {
  it("answers every message on its scope", async () => {
    const wired: { listener: (event: MessageEvent<AvatarRequest>) => void } = { listener: () => undefined };
    const posted: AvatarReply[] = [];
    vi.stubGlobal("OffscreenCanvas", class {
      convertToBlob = async () => png;
    });
    wireAvatarWorker({ addEventListener: (_type, l) => {
        wired.listener = l;
      }, postMessage: (reply) => posted.push(reply) });
    wired.listener({ data: { id: 9, modelKey: "hawthorn" } } as MessageEvent<AvatarRequest>);
    await vi.waitFor(() => expect(posted).toEqual([{ id: 9, blob: png, failed: false }]));
  });

  it("wires itself to the global scope on import", async () => {
    const add = vi.spyOn(globalThis, "addEventListener");
    await import("../../../../src/components/residents/models/avatarWorker");
    expect(add).toHaveBeenCalledWith("message", expect.any(Function));
  });
});

/* A stand-in Worker: records what's posted and lets the test reply or error. */
class FakeWorker {
  posted: AvatarRequest[] = [];
  onmessage: ((event: MessageEvent<AvatarReply>) => void) | null = null;
  onerror: (() => void) | null = null;
  postMessage(request: AvatarRequest): void {
    this.posted.push(request);
  }
  reply(reply: AvatarReply): void {
    this.onmessage?.({ data: reply } as MessageEvent<AvatarReply>);
  }
}

describe("AvatarWorkerClient", () => {
  it("starts the worker once and matches each reply to its request", async () => {
    const fake = new FakeWorker();
    const start = vi.fn(() => fake as unknown as Worker);
    const client = new AvatarWorkerClient(start);
    const first = client.render("hawthorn");
    const second = client.render("juniper");
    expect(start).toHaveBeenCalledTimes(1);
    expect(fake.posted).toEqual([{ id: 1, modelKey: "hawthorn" }, { id: 2, modelKey: "juniper" }]);
    fake.reply({ id: 2, blob: null, failed: false });
    fake.reply({ id: 1, blob: png, failed: false });
    expect(await first).toEqual({ id: 1, blob: png, failed: false });
    expect(await second).toEqual({ id: 2, blob: null, failed: false });
  });

  it("fails everything waiting, and everything after, once the worker errors", async () => {
    const fake = new FakeWorker();
    const client = new AvatarWorkerClient(() => fake as unknown as Worker);
    const waiting = client.render("hawthorn");
    fake.onerror?.();
    expect(await waiting).toEqual({ id: 1, blob: null, failed: true });
    expect(await client.render("juniper")).toEqual({ id: 2, blob: null, failed: true });
  });

  it("starts the real module worker by default", () => {
    const started: unknown[][] = [];
    vi.stubGlobal("Worker", class extends FakeWorker {
      constructor(...args: unknown[]) {
        super();
        started.push(args);
      }
    });
    void new AvatarWorkerClient().render("hawthorn");
    expect(started).toHaveLength(1);
    expect(String(started[0][0])).toContain("avatarWorker");
    expect(started[0][1]).toEqual({ type: "module" });
  });

  it("is supported only with workers, OffscreenCanvas PNG encoding and blob URLs", () => {
    vi.stubGlobal("Worker", class {});
    vi.stubGlobal("OffscreenCanvas", class {
      convertToBlob(): void {}
    });
    expect(avatarWorkerSupported()).toBe(typeof URL.createObjectURL === "function");
    vi.stubGlobal("OffscreenCanvas", undefined);
    expect(avatarWorkerSupported()).toBe(false);
  });
});
