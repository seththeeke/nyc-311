import type { ReactElement } from "react";
import { FleetMap } from "../FleetMap";
import { useFleetLocations } from "../../hooks/useFleetLocations";
import { SpinnerIcon } from "../icons";

/**
 * The fleet map plus its loading/error pills (`10-capacity-modeling-and-integration.md`
 * §6.1). The map always renders, even before locations resolve or if fetching
 * fails — status overlays on top instead of replacing it, so a transient fetch
 * failure never blanks the view.
 */
export function FleetMapWidget(): ReactElement {
  const { locations, isLoading, error } = useFleetLocations();

  return (
    <div className="relative h-full w-full">
      <FleetMap operators={locations?.operators ?? []} />
      {isLoading && (
        <div className="pointer-events-none absolute top-4 left-4 z-[1000] flex items-center gap-2 rounded-full bg-surface/90 px-3 py-1.5 text-sm text-fg-muted shadow-lg">
          <SpinnerIcon className="h-4 w-4" />
          Loading fleet…
        </div>
      )}
      {error && (
        <div
          role="alert"
          className="absolute top-4 left-4 z-[1000] rounded-lg bg-danger-soft px-3 py-1.5 text-sm text-danger shadow-lg backdrop-blur"
        >
          Couldn&apos;t load the fleet: {error.message}
        </div>
      )}
    </div>
  );
}
