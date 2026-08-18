import type { ReactElement } from "react";
import { MonitoringTile, type MonitoringTileAccent } from "../MonitoringTile";

interface MonitoringTileConfig {
  title: string;
  description: string;
  to: string;
  accent: MonitoringTileAccent;
  icon: ReactElement;
}

const ICON_STROKE_PROPS = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function IngestionIcon(): ReactElement {
  return (
    <svg {...ICON_STROKE_PROPS} className="h-6 w-6">
      <path d="M12 3v11m0 0l-4-4m4 4l4-4" />
      <path d="M4 16v2a3 3 0 003 3h10a3 3 0 003-3v-2" />
    </svg>
  );
}

function PipelineIcon(): ReactElement {
  return (
    <svg {...ICON_STROKE_PROPS} className="h-6 w-6">
      <circle cx="4.5" cy="12" r="2" />
      <circle cx="12" cy="5.5" r="2" />
      <circle cx="12" cy="18.5" r="2" />
      <circle cx="19.5" cy="12" r="2" />
      <path d="M6.5 12h3M17.5 12h-3M13 7l3.2 3.2M13 17l3.2-3.2" />
    </svg>
  );
}

const MONITORING_TILES: MonitoringTileConfig[] = [
  {
    title: "Ingestion",
    description: "NYC 311 poller run history and status.",
    to: "/monitoring/ingestion",
    accent: "cyan",
    icon: <IngestionIcon />,
  },
  {
    title: "Pipeline",
    description: "Nyc311Pipeline stage status and deploy history.",
    to: "/monitoring/pipeline",
    accent: "violet",
    icon: <PipelineIcon />,
  },
];

export function MonitoringPage(): ReactElement {
  return (
    <main className="relative min-h-screen overflow-hidden bg-slate-950">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="animate-aurora-1 absolute -top-32 -left-32 h-[32rem] w-[32rem] rounded-full bg-blue-600/30 blur-3xl" />
        <div className="animate-aurora-2 absolute top-1/3 -right-24 h-[28rem] w-[28rem] rounded-full bg-violet-600/30 blur-3xl" />
        <div className="animate-aurora-3 absolute bottom-0 left-1/4 h-[24rem] w-[24rem] rounded-full bg-cyan-500/20 blur-3xl" />
      </div>
      <div
        aria-hidden="true"
        className="bg-grid-glow pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_65%_55%_at_50%_0%,black,transparent)]"
      />

      <div className="relative mx-auto max-w-5xl px-6 py-20 sm:py-28">
        <div className="animate-fade-in-up inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-slate-300 backdrop-blur">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
          </span>
          Live &middot; Nyc311
        </div>

        <h1
          className="animate-fade-in-up mt-6 bg-gradient-to-r from-cyan-300 via-blue-300 to-violet-300 bg-clip-text text-5xl font-black tracking-tight text-transparent sm:text-6xl"
          style={{ animationDelay: "80ms" }}
        >
          Monitoring
        </h1>
        <p className="animate-fade-in-up mt-4 max-w-xl text-lg text-slate-400" style={{ animationDelay: "150ms" }}>
          Real-time visibility into the ingestion poller and the deploy pipeline — read-only, always on.
        </p>

        <div
          className="animate-fade-in-up mt-12 grid grid-cols-1 gap-5 sm:grid-cols-2"
          style={{ animationDelay: "220ms" }}
        >
          {MONITORING_TILES.map((tile) => (
            <MonitoringTile key={tile.to} {...tile} />
          ))}
        </div>
      </div>
    </main>
  );
}
