import type { WebGLRenderer } from "three";
import { AVATAR_PIXELS, createAvatarRenderer, drawAvatar } from "./avatarSnapshot";

/* One avatar asked of the worker, and its answer: a PNG, null for a key with no model, or `failed` when the worker can't draw at all. */
export interface AvatarRequest {
  id: number;
  modelKey: string;
}
export interface AvatarReply {
  id: number;
  blob: Blob | null;
  failed: boolean;
}

/* The slice of a dedicated worker's global scope the avatar worker uses. */
export interface AvatarWorkerScope {
  addEventListener(type: "message", listener: (event: MessageEvent<AvatarRequest>) => void): void;
  postMessage(reply: AvatarReply): void;
}

let renderer: WebGLRenderer | null = null;

/** Test hook: drop the worker's renderer. */
export function resetAvatarWorkerRenderer(): void {
  renderer = null;
}

/**
 * Draws one avatar off the main thread: the same scene code as the page,
 * on an OffscreenCanvas, encoded as a PNG blob. Any failure (no WebGL in
 * workers, a lost context) answers `failed`, and the page draws it itself.
 */
export async function answerAvatarRequest(
  request: AvatarRequest,
  makeCanvas: () => OffscreenCanvas = () => new OffscreenCanvas(AVATAR_PIXELS, AVATAR_PIXELS),
): Promise<AvatarReply> {
  try {
    renderer ??= createAvatarRenderer(makeCanvas());
    if (!drawAvatar(renderer, request.modelKey)) return { id: request.id, blob: null, failed: false };
    const canvas = renderer.domElement as unknown as OffscreenCanvas;
    return { id: request.id, blob: await canvas.convertToBlob({ type: "image/png" }), failed: false };
  } catch {
    return { id: request.id, blob: null, failed: true };
  }
}

/** Answers every request that arrives on `scope`. */
export function wireAvatarWorker(scope: AvatarWorkerScope): void {
  scope.addEventListener("message", (event) => {
    void answerAvatarRequest(event.data).then((reply) => scope.postMessage(reply));
  });
}
