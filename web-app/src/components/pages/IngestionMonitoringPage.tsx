import type { ReactElement } from "react";
import { Link } from "react-router-dom";

export function IngestionMonitoringPage(): ReactElement {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <Link to="/monitoring" className="text-sm text-blue-600 underline">
        &larr; Monitoring
      </Link>
      <h1 className="mt-4 text-2xl font-semibold text-slate-900">Ingestion</h1>
      <p className="mt-2 text-slate-600">Coming soon.</p>
    </main>
  );
}
