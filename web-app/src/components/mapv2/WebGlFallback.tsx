import type { ReactElement } from "react";
import { Link } from "react-router-dom";
import { GLASS } from "./hudStyle";

/** Shown instead of the 3-D map when the browser can't create a WebGL2 context. */
export function WebGlFallback(): ReactElement {
  return (
    <main className="flex h-full w-full items-center justify-center bg-surface p-4">
      <div role="alert" className={`${GLASS} max-w-md p-6 text-center`}>
        <h1 className="text-lg font-semibold text-fg">3-D map unavailable</h1>
        <p className="mt-2 text-sm text-fg-muted">
          Mapv2 needs WebGL2, which this browser or device has turned off. The classic map shows the same fleet.
        </p>
        <Link to="/" className="mt-4 inline-block rounded-xl bg-cyan-600 px-4 py-2 text-sm font-semibold text-on-accent focus-visible:ring-2 focus-visible:ring-hue-cyan focus-visible:outline-none">
          Open the classic map
        </Link>
      </div>
    </main>
  );
}
