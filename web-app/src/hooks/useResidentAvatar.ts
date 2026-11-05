import { useEffect, useState } from "react";
import { isWebGlAvailable } from "../components/three/webgl";

/* One snapshot per model for the life of the page; null when it could not be drawn. */
const snapshots = new Map<string, string | null>();
/* Renders already queued, so two avatars of one model share a single render. */
const pending = new Map<string, Promise<string | null>>();
/* The tail of the render queue: renders run one after another, never in one burst. */
let queue: Promise<unknown> = Promise.resolve();

/* An idle render still runs within this long, so a busy page doesn't starve its avatars. */
const IDLE_TIMEOUT_MS = 1500;

/** Test hook: forget every snapshot and queued render. */
export function clearResidentAvatars(): void {
  snapshots.clear();
  pending.clear();
  queue = Promise.resolve();
}

function whenIdle(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window.requestIdleCallback === "function") window.requestIdleCallback(() => resolve(), { timeout: IDLE_TIMEOUT_MS });
    else window.setTimeout(resolve, 0);
  });
}

/* The fallback: draw on the main thread, one render per idle slot, since each is a 50-250ms task. */
async function drawOnPage(modelKey: string): Promise<string | null> {
  await whenIdle();
  const { renderResidentAvatar } = await import("../components/residents/models/avatarSnapshot");
  return renderResidentAvatar(modelKey);
}

/*
 * Draws one model's snapshot: in the avatar worker where the browser can,
 * so building and photographing a 3-D figure never blocks the page, and on
 * the page otherwise. Renders queue one after another, never in one burst.
 */
async function drawAnywhere(modelKey: string): Promise<string | null> {
  const { avatarWorkerClient, avatarWorkerSupported } = await import("../components/residents/models/avatarWorkerClient");
  if (avatarWorkerSupported()) {
    const reply = await avatarWorkerClient.render(modelKey);
    if (!reply.failed) return reply.blob ? URL.createObjectURL(reply.blob) : null;
  }
  return drawOnPage(modelKey);
}

function drawSnapshot(modelKey: string): Promise<string | null> {
  const inFlight = pending.get(modelKey);
  if (inFlight) return inFlight;
  const job = queue
    .then(() => drawAnywhere(modelKey))
    .catch(() => null)
    .then((drawn) => {
      snapshots.set(modelKey, drawn);
      pending.delete(modelKey);
      return drawn;
    });
  queue = job;
  pending.set(modelKey, job);
  return job;
}

/**
 * A resident's head-and-shoulders snapshot as an image URL, or null —
 * no model, no WebGL, or not drawn yet — in which case the avatar shows
 * the initial. The renderer is imported on first use, keeping Three.js
 * out of the main bundle.
 */
export function useResidentAvatar(modelKey: string | null): string | null {
  const [url, setUrl] = useState<string | null>(() => (modelKey ? (snapshots.get(modelKey) ?? null) : null));
  useEffect(() => {
    if (!modelKey) {
      setUrl(null);
      return undefined;
    }
    if (snapshots.has(modelKey)) {
      setUrl(snapshots.get(modelKey) ?? null);
      return undefined;
    }
    if (!isWebGlAvailable()) {
      snapshots.set(modelKey, null);
      setUrl(null);
      return undefined;
    }
    let live = true;
    void drawSnapshot(modelKey).then((drawn) => {
      if (live) setUrl(drawn);
    });
    return () => {
      live = false;
    };
  }, [modelKey]);
  return url;
}
