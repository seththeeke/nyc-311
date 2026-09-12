import type { ReactElement } from "react";
import { FleetMap } from "../FleetMap";
import { useFleetLocations } from "../../hooks/useFleetLocations";

/**
 * The public landing page — the fleet map
 * (`10-capacity-modeling-and-integration.md` §6.1), full-bleed under the
 * global header (`Header.tsx`'s `h-14`), Google-Maps-style: no title/nav
 * of its own, since the header already carries the app name and links.
 * The map always renders, even before locations resolve or if fetching
 * them fails — loading/error state overlays on top instead of replacing
 * it, so a transient fetch failure never blanks the whole view.
 */
export function HomePage(): ReactElement {
  const { locations, isLoading, error } = useFleetLocations();

  return (
    <main className="relative h-[calc(100vh-3.5rem)] w-full">
      <FleetMap operators={locations?.operators ?? []} />

      {isLoading && (
        <div className="pointer-events-none absolute top-4 left-4 z-[1000] rounded-full bg-slate-950/90 px-3 py-1.5 text-sm text-slate-300 shadow-lg">
          Loading fleet…
        </div>
      )}
      {error && (
        <div
          role="alert"
          className="absolute top-4 left-4 z-[1000] rounded-lg bg-red-950/95 px-3 py-1.5 text-sm text-red-200 shadow-lg"
        >
          Couldn&apos;t load the fleet: {error.message}
        </div>
      )}
    </main>
  );
}
