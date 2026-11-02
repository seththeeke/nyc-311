import type { ReactElement } from "react";
import { GLASS } from "./hudStyle";

/** Shown instead of the 3-D map when the browser can't create a WebGL2 context. */
export function WebGlFallback(): ReactElement {
  return (
    <main className="flex h-full w-full items-center justify-center bg-surface p-4">
      <div role="alert" className={`${GLASS} max-w-md p-6 text-center`}>
        <h1 className="text-lg font-semibold text-fg">3-D map unavailable</h1>
        <p className="mt-2 text-sm text-fg-muted">
          The map needs WebGL2, which this browser or device has turned off. The fleet summary in the side panel still shows the fleet.
        </p>
      </div>
    </main>
  );
}
