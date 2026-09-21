import { vi } from "vitest";

/*
 * Stubs window.matchMedia so (min-width: Npx) queries resolve against a
 * chosen viewport width. `setWidth` re-evaluates every live listener, the
 * way a real window resize would.
 */
export function mockViewport(initialWidth: number): { setWidth: (width: number) => void } {
  let width = initialWidth;
  const listeners = new Set<() => void>();

  const matches = (query: string): boolean => {
    const match = /min-width:\s*(\d+)px/.exec(query);
    return match ? width >= Number(match[1]) : false;
  };

  vi.stubGlobal("matchMedia", (query: string) => {
    const list = {
      get matches() {
        return matches(query);
      },
      media: query,
      addEventListener: (_: string, fn: () => void) => listeners.add(fn),
      removeEventListener: (_: string, fn: () => void) => listeners.delete(fn),
    };
    return list;
  });

  return {
    setWidth: (next: number) => {
      width = next;
      listeners.forEach((fn) => fn());
    },
  };
}
