import type { ReactElement } from "react";
import { Link } from "react-router-dom";
import { FleetMap } from "../FleetMap";
import { useFleetLocations } from "../../hooks/useFleetLocations";

/**
 * The public landing page — now also the fleet map
 * (`10-capacity-modeling-and-integration.md` §6.1), a live, read-only
 * view of every active Operator's current GPS position. First visual way
 * to verify scheduling/execution actually moves vehicles around.
 */
export function HomePage(): ReactElement {
  const { locations, isLoading, error } = useFleetLocations();

  return (
    <main className="mx-auto max-w-5xl px-6 py-16">
      <h1 className="text-2xl font-semibold text-slate-900">BoroughSim</h1>
      <p className="mt-2 text-slate-600">
        <Link to="/monitoring" className="text-blue-600 underline">
          View system monitoring
        </Link>
      </p>

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-slate-900">Live fleet</h2>
        {isLoading && <p className="mt-2 text-slate-500">Loading…</p>}
        {error && (
          <p role="alert" className="mt-2 text-red-600">
            {error.message}
          </p>
        )}
        {locations && (
          <div className="mt-3">
            <FleetMap operators={locations.operators} />
          </div>
        )}
      </section>
    </main>
  );
}
