import type { ReactElement } from "react";
import { MonitoringTile } from "../MonitoringTile";

interface MonitoringTileConfig {
  title: string;
  description: string;
  to: string;
}

const MONITORING_TILES: MonitoringTileConfig[] = [
  {
    title: "Ingestion",
    description: "NYC 311 poller run history and status.",
    to: "/monitoring/ingestion",
  },
  {
    title: "Pipeline",
    description: "Nyc311Pipeline stage status and deploy history.",
    to: "/monitoring/pipeline",
  },
];

export function MonitoringPage(): ReactElement {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-2xl font-semibold text-slate-900">Monitoring</h1>
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {MONITORING_TILES.map((tile) => (
          <MonitoringTile key={tile.to} {...tile} />
        ))}
      </div>
    </main>
  );
}
