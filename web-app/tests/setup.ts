import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";
import { Window } from "happy-dom";
import "@testing-library/jest-dom/vitest";

/**
 * Node 22+'s own experimental global `localStorage`/`sessionStorage` sits on
 * `globalThis` before happy-dom's vitest environment runs. Vitest's
 * `populateGlobal()` skips re-defining any key already on `global` unless
 * it's in its own fixed allowlist — neither storage key is — so happy-dom's
 * real Storage never gets wired up and every access throws. A standalone
 * happy-dom `Window`'s Storage instances, installed in its place, work
 * regardless of the Node version running the suite.
 */
const storageWindow = new Window({ url: "http://localhost:3000" });
Object.defineProperty(globalThis, "localStorage", {
  value: storageWindow.localStorage,
  configurable: true,
  writable: true,
});
Object.defineProperty(globalThis, "sessionStorage", {
  value: storageWindow.sessionStorage,
  configurable: true,
  writable: true,
});

afterEach(() => {
  cleanup();
});
