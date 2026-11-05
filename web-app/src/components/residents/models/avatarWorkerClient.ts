import type { AvatarReply } from "./avatarWorkerCore";

/** Whether this browser can draw avatars in a worker: workers, OffscreenCanvas with PNG encoding, and blob URLs. */
export function avatarWorkerSupported(): boolean {
  return (
    typeof Worker !== "undefined" &&
    typeof OffscreenCanvas !== "undefined" &&
    typeof OffscreenCanvas.prototype.convertToBlob === "function" &&
    typeof URL.createObjectURL === "function"
  );
}

const startWorker = (): Worker => new Worker(new URL("./avatarWorker.ts", import.meta.url), { type: "module" });

/*
 * The page's side of the avatar worker: started on first use, one request
 * per avatar matched to its reply by id. If the worker itself errors, every
 * waiting request is answered `failed` and later ones fail at once, so the
 * page falls back to drawing them itself.
 */
export class AvatarWorkerClient {
  private worker: Worker | null = null;
  private broken = false;
  private nextId = 1;
  private readonly waiting = new Map<number, (reply: AvatarReply) => void>();
  private readonly start: () => Worker;

  constructor(start: () => Worker = startWorker) {
    this.start = start;
  }

  render(modelKey: string): Promise<AvatarReply> {
    const id = this.nextId;
    this.nextId += 1;
    if (this.broken) return Promise.resolve({ id, blob: null, failed: true });
    const worker = this.connect();
    return new Promise((resolve) => {
      this.waiting.set(id, resolve);
      worker.postMessage({ id, modelKey });
    });
  }

  private connect(): Worker {
    if (this.worker) return this.worker;
    const worker = this.start();
    worker.onmessage = (event: MessageEvent<AvatarReply>) => {
      this.waiting.get(event.data.id)?.(event.data);
      this.waiting.delete(event.data.id);
    };
    worker.onerror = () => {
      this.broken = true;
      for (const [id, resolve] of this.waiting) resolve({ id, blob: null, failed: true });
      this.waiting.clear();
    };
    this.worker = worker;
    return worker;
  }
}

export const avatarWorkerClient = new AvatarWorkerClient();
