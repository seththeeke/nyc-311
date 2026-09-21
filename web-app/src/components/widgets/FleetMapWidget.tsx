import type { ReactElement } from "react";
import { FleetMap } from "../FleetMap";
import { FleetMapLegend } from "../FleetMapLegend";
import { useFleetLocations } from "../../hooks/useFleetLocations";
import { SpinnerIcon } from "../icons";

/**
 * The fleet map plus its loading/error pills (`10-capacity-modeling-and-integration.md`
 * §6.1). The map always renders, even before locations resolve or if fetching
 * fails — status overlays on top instead of replacing it, so a transient fetch
 * failure never blanks the view. Loading is a large centered message so it
 * can't be missed; the legend floats under the map's zoom controls.
 */
export function FleetMapWidget(): ReactElement {
  const { locations, isLoading, error } = useFleetLocations();

  return (
    <div className="relative h-full w-full">
      <FleetMap operators={locations?.operators ?? []} />
      <FleetMapLegend />
      {isLoading && (
        <div className="pointer-events-none absolute inset-0 z-[1000] flex items-center justify-center">
          <div
            role="status"
            className="flex items-center gap-4 rounded-2xl border border-line bg-popover/95 px-8 py-5 text-3xl font-semibold text-fg shadow-2xl"
          >
            <SpinnerIcon className="h-10 w-10" />
            Loading fleet…
          </div>
        </div>
      )}
      {error && (
        <div
          role="alert"
          className="absolute top-4 left-1/2 z-[1000] -translate-x-1/2 rounded-lg bg-danger-soft px-3 py-1.5 text-sm text-danger shadow-lg backdrop-blur"
        >
          Couldn&apos;t load the fleet: {error.message}
        </div>
      )}
    </div>
  );
}
