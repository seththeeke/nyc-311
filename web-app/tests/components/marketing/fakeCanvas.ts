import { vi } from "vitest";

/* A 2-D context stand-in: every method is a spy, and gradients accept colour stops. */
export function fakeContext2d(): CanvasRenderingContext2D {
  const calls: Record<string, ReturnType<typeof vi.fn>> = {};
  const target: Record<string, unknown> = {
    createRadialGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
  };
  return new Proxy(target, {
    get(obj, key: string) {
      if (key in obj) return obj[key];
      calls[key] ??= vi.fn();
      return calls[key];
    },
    set(obj, key: string, value: unknown) {
      obj[key] = value;
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
}
